import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TASK_PROJECT_STATUSES,
  type SortOption,
  type TaskProjectItem,
  type TaskProjectStatus,
  type TaskProjectOption,
} from "../../types/workItem";
import { workItemsService } from "../../services/workItemsService";
import { loadOwnerDirectory, type OwnerDirectoryEntry } from "../../services/ownerDirectoryService";
import { WidgetCard } from "./WidgetCard";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { formatDate } from "../../utils/dates";
import { useToast } from "../ui/Toast";
import type { OwnerIdentity } from "../../utils/ownerMatching";
import { workItemMatchesOwnerIdentity } from "../../utils/ownerMatching";
import { formatOwnerLabel } from "../../utils/owners";

type Filter = "all" | string;

const ADD_NEW_OPTION_VALUE = "__add_new_project__";

type FormState = {
  title: string;
  requester: string;
  ownerGoogleId: string;
  status: TaskProjectStatus;
  category: "downtime" | "project";
  tags: string;
  description: string;
  projectName: string;
  newProjectName: string;
};

const defaultForm: FormState = {
  title: "",
  requester: "",
  ownerGoogleId: "",
  status: "submitted",
  category: "project",
  tags: "",
  description: "",
  projectName: "",
  newProjectName: "",
};

export const TasksWidget = ({
  resetSignal,
  canManage,
  includeDeleted = false,
  canRestore = false,
  selectedOwnerIdentity = null,
  projectFilter = "all",
  onProjectOptionsRefresh,
}: {
  resetSignal: number;
  canManage: boolean;
  includeDeleted?: boolean;
  canRestore?: boolean;
  selectedOwnerIdentity?: OwnerIdentity | null;
  projectFilter?: "all" | "none" | string;
  onProjectOptionsRefresh?: () => Promise<void> | void;
}) => {
  const [items, setItems] = useState<TaskProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortOption>("status_priority");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskProjectItem | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { notify } = useToast();
  const [ownerOptions, setOwnerOptions] = useState<OwnerDirectoryEntry[]>([]);
  const [projectOptions, setProjectOptions] = useState<TaskProjectOption[]>([]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [data, options] = await Promise.all([
        workItemsService.getWorkItems({ type: "task_project", statusFilter: filter, sort, includeDeleted }),
        workItemsService.listTaskProjectOptions(),
      ]);
      setItems(data as TaskProjectItem[]);
      setProjectOptions(options);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [filter, sort, resetSignal, includeDeleted]);

  useEffect(() => {
    const loadOwners = async () => {
      const response = await loadOwnerDirectory();
      setOwnerOptions(response.owners);
    };

    void loadOwners();
  }, []);

  const filterOptions = useMemo(
    () => [
      { label: "All", value: "all" },
      ...TASK_PROJECT_STATUSES.map((status) => ({ label: status.label, value: status.key })),
    ],
    [],
  );

  const visibleItems = useMemo(() => {
    const ownerFiltered = selectedOwnerIdentity
      ? items.filter((item) => workItemMatchesOwnerIdentity(item, selectedOwnerIdentity))
      : items;

    if (projectFilter === "all") {
      return ownerFiltered;
    }

    if (projectFilter === "none") {
      return ownerFiltered.filter((item) => !item.projectName?.trim());
    }

    return ownerFiltered.filter((item) => item.projectName === projectFilter);
  }, [items, projectFilter, selectedOwnerIdentity]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (item: TaskProjectItem) => {
    setEditing(item);
    setErrors({});
    setForm({
      title: item.title,
      requester: item.requester,
      ownerGoogleId: item.ownerGoogleId,
      status: item.status,
      category: item.category,
      tags: item.tags?.join(", ") ?? "",
      description: item.description ?? "",
      projectName: item.projectName ?? "",
      newProjectName: "",
    });
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required";
    if (!form.requester.trim()) nextErrors.requester = "Requester is required";
    if (!form.ownerGoogleId.trim()) nextErrors.ownerGoogleId = "Owner is required";
    if (form.projectName === ADD_NEW_OPTION_VALUE && !form.newProjectName.trim()) {
      nextErrors.newProjectName = "Project name is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resolveProjectName = async (): Promise<string | undefined> => {
    if (form.projectName === ADD_NEW_OPTION_VALUE) {
      const created = await workItemsService.createTaskProjectOption(form.newProjectName.trim());
      const updatedOptions = await workItemsService.listTaskProjectOptions();
      setProjectOptions(updatedOptions);
      await onProjectOptionsRefresh?.();
      return created.name;
    }

    return form.projectName.trim() || undefined;
  };

  const submit = async () => {
    if (!validate()) return;

    const selectedOwner = ownerOptions.find((owner) => owner.googleId === form.ownerGoogleId);
    if (!selectedOwner) {
      setErrors((prev) => ({ ...prev, ownerGoogleId: "Owner is required" }));
      return;
    }

    const projectName = await resolveProjectName();

    const payload = {
      type: "task_project" as const,
      title: form.title.trim(),
      requester: form.requester.trim(),
      ownerGoogleId: selectedOwner.googleId,
      ownerEmail: selectedOwner.email,
      ownerName: selectedOwner.displayName,
      status: form.status as TaskProjectStatus,
      category: form.category,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: form.description.trim() || undefined,
      projectName,
    };

    if (editing) {
      await workItemsService.updateWorkItem(editing.id, payload);
      notify("Updated");
    } else {
      await workItemsService.createWorkItem(payload);
      notify("Created");
    }

    setModalOpen(false);
    await loadItems();
  };

  const updateInline = async (id: string, patch: Partial<TaskProjectItem>) => {
    await workItemsService.updateWorkItem(id, patch);
    notify("Updated");
    await loadItems();
  };

  const handleComplete = async (id: string) => {
    await workItemsService.completeWorkItem(id);
    notify("Completed");
    await loadItems();
  };

  const handleDelete = async (id: string) => {
    await workItemsService.softDeleteWorkItem(id);
    notify("Deleted");
    await loadItems();
  };

  const handleRestore = async (id: string) => {
    await workItemsService.restoreWorkItem(id);
    notify("Restored");
    await loadItems();
  };

  return (
    <>
      <WidgetCard
        title="Tasks / Projects"
        subtitle="Manage downtime and project work"
        controls={
          <div className="flex flex-wrap gap-2">
            <Select className="min-w-32" value={filter} onChange={(e) => setFilter(e.target.value)} options={filterOptions} />
            <Select
              className="min-w-36"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              options={[
                { label: "Created (Newest)", value: "created_desc" },
                { label: "Created (Oldest)", value: "created_asc" },
                { label: "Status Priority", value: "status_priority" },
              ]}
            />
            <Button onClick={openCreate} disabled={!canManage}>Add New</Button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No items match your filters</p>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <div key={item.id} className="relative rounded-lg border border-slate-200 p-3 pr-28">
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  {item.deleted ? <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Deleted</span> : null}
                  <Badge status={item.status} label={item.statusLabel} />
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/work-items/${item.id}`} className="cursor-pointer font-medium text-slate-900 hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {item.category === "downtime" ? "Downtime" : "Project"} • Owner {formatOwnerLabel(item)} • Created {formatDate(item.createdAt)}
                    </p>
                    <p className="text-xs text-slate-500">Project: {item.projectName || "No Project"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
                  <Select
                    options={TASK_PROJECT_STATUSES.map((status) => ({ label: status.label, value: status.key }))}
                    value={item.status}
                    disabled={!canManage}
                    onChange={(e) => void updateInline(item.id, { status: e.target.value as TaskProjectStatus })}
                  />
                  <Select
                    options={ownerOptions.map((owner) => ({ label: owner.displayName, value: owner.googleId }))}
                    value={item.ownerGoogleId}
                    disabled={!canManage}
                    onChange={(e) => {
                      const nextOwner = ownerOptions.find((owner) => owner.googleId === e.target.value);
                      if (!nextOwner) return;
                      void updateInline(item.id, { ownerGoogleId: nextOwner.googleId, ownerEmail: nextOwner.email, ownerName: nextOwner.displayName });
                    }}
                  />
                  <Button variant="secondary" onClick={() => openEdit(item)} disabled={!canManage}>
                    Edit
                  </Button>
                  {item.deleted && canRestore ? (
                    <Button variant="secondary" onClick={() => void handleRestore(item.id)}>
                      Restore
                    </Button>
                  ) : (
                    <Button onClick={() => void handleComplete(item.id)} disabled={!canManage || item.deleted || item.status === "completed"}>
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>

      <Modal title={editing ? "Edit Task / Project" : "Add Task / Project"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Title" value={form.title} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Requester" value={form.requester} error={errors.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} />
          <Select label="Owner" value={form.ownerGoogleId} error={errors.ownerGoogleId} options={[{ label: "Select owner", value: "" }, ...ownerOptions.map((owner) => ({ label: owner.displayName, value: owner.googleId }))]} onChange={(e) => setForm({ ...form, ownerGoogleId: e.target.value })} />
          <Select label="Status" value={form.status} options={TASK_PROJECT_STATUSES.map((status) => ({ label: status.label, value: status.key }))} onChange={(e) => setForm({ ...form, status: e.target.value as TaskProjectStatus })} />
          <Select
            label="Project"
            value={form.projectName}
            options={[
              { label: "No Project", value: "" },
              ...projectOptions.map((option) => ({ label: option.name, value: option.name })),
              { label: "Add New...", value: ADD_NEW_OPTION_VALUE },
            ]}
            onChange={(e) => setForm({ ...form, projectName: e.target.value, newProjectName: e.target.value === ADD_NEW_OPTION_VALUE ? form.newProjectName : "" })}
          />
          {form.projectName === ADD_NEW_OPTION_VALUE ? (
            <Input
              label="New Project Name"
              value={form.newProjectName}
              error={errors.newProjectName}
              onChange={(e) => setForm({ ...form, newProjectName: e.target.value })}
            />
          ) : null}
          <Select
            label="Category"
            value={form.category}
            options={[
              { label: "Project", value: "project" },
              { label: "Downtime", value: "downtime" },
            ]}
            onChange={(e) => setForm({ ...form, category: e.target.value as "downtime" | "project" })}
          />
          <Input label="Tags (Optional, comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Description (Optional)</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <div>
            {editing ? (<Button variant="danger" onClick={() => void handleDelete(editing.id)} disabled={!canManage}>Delete</Button>) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={!canManage}>{editing ? "Save Changes" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

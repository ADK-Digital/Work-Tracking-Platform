import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TASK_PROJECT_STATUSES,
  type Attachment,
  type SortOption,
  type TaskProjectItem,
  type TaskProjectStatus,
  type TaskProjectOption,
} from "../../types/workItem";
import { getWorkItemsDataProvider } from "../../providers/data/workItemsDataProvider";
import { loadOwnerDirectory, type OwnerDirectoryEntry } from "../../services/ownerDirectoryService";
import { WidgetCard } from "./WidgetCard";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { DemoAttachmentNote } from "../demo/DemoAttachmentNote";
import { formatDate } from "../../utils/dates";
import { isDemoMode } from "../../config/appMode";
import { useToast } from "../ui/Toast";
import type { OwnerIdentity } from "../../utils/ownerMatching";
import { workItemMatchesOwnerIdentity } from "../../utils/ownerMatching";
import { formatOwnerLabel, getOwnerDisplayName } from "../../utils/owners";

type Filter = "all" | string;

const ADD_NEW_OPTION_VALUE = "__add_new_project__";

const workItemsDataProvider = getWorkItemsDataProvider();

type FormState = {
  title: string;
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
  ownerGoogleId: "",
  status: "submitted",
  category: "project",
  tags: "",
  description: "",
  projectName: "",
  newProjectName: "",
};

export const TasksWidget = ({
  canManage,
  includeDeleted = false,
  canRestore = false,
  selectedOwnerIdentity = null,
}: {
  canManage: boolean;
  includeDeleted?: boolean;
  canRestore?: boolean;
  selectedOwnerIdentity?: OwnerIdentity | null;
}) => {
  const [items, setItems] = useState<TaskProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortOption>("status_priority");
  const [projectFilter, setProjectFilter] = useState<"all" | "none" | string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskProjectItem | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [existingAttachmentsLoading, setExistingAttachmentsLoading] = useState(false);
  const { notify } = useToast();
  const [ownerOptions, setOwnerOptions] = useState<OwnerDirectoryEntry[]>([]);
  const [projectOptions, setProjectOptions] = useState<TaskProjectOption[]>([]);

  const ownerOptionsByGoogleId = useMemo(
    () => new Map(ownerOptions.map((owner) => [owner.googleId, owner])),
    [ownerOptions],
  );

  const loadItems = async () => {
    setLoading(true);
    try {
      const [data, options] = await Promise.all([
        workItemsDataProvider.getWorkItems({ type: "task_project", statusFilter: filter, sort, includeDeleted }),
        workItemsDataProvider.listTaskProjectOptions(),
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
  }, [filter, sort, includeDeleted]);

  useEffect(() => {
    const loadOwners = async () => {
      const response = await loadOwnerDirectory();
      setOwnerOptions(response.owners);
    };

    void loadOwners();
  }, []);


  const mergedItemOwnerOptions = useMemo(() => {
    const merged = new Map(ownerOptions.map((owner) => [owner.googleId, owner]));

    for (const item of items) {
      if (!item.ownerGoogleId || !item.ownerEmail || merged.has(item.ownerGoogleId)) {
        continue;
      }

      merged.set(item.ownerGoogleId, {
        googleId: item.ownerGoogleId,
        email: item.ownerEmail,
        displayName: item.ownerEmail,
      });
    }

    return [...merged.values()];
  }, [items, ownerOptions]);

  const filterOptions = useMemo(
    () => [
      { label: "All", value: "all" },
      ...TASK_PROJECT_STATUSES.map((status) => ({ label: status.label, value: status.key })),
    ],
    [],
  );

  const ownerScopedItems = useMemo(
    () =>
      selectedOwnerIdentity
      ? items.filter((item) => workItemMatchesOwnerIdentity(item, selectedOwnerIdentity))
      : items,
    [items, selectedOwnerIdentity],
  );

  const projectFilterOptions = useMemo(() => {
    const projectNames = new Set<string>();

    for (const item of ownerScopedItems) {
      const name = item.projectName?.trim();
      if (!name) {
        continue;
      }

      projectNames.add(name);
    }

    return [...projectNames].sort((a, b) => a.localeCompare(b));
  }, [ownerScopedItems]);

  const modalProjectOptions = useMemo(() => {
    const names = new Set(projectOptions.map((option) => option.name.trim()).filter(Boolean));
    const currentProjectName = form.projectName?.trim();

    if (editing && currentProjectName && currentProjectName !== ADD_NEW_OPTION_VALUE) {
      names.add(currentProjectName);
    }

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [editing, form.projectName, projectOptions]);

  useEffect(() => {
    if (projectFilter === "all" || projectFilter === "none") {
      return;
    }

    if (!projectFilterOptions.includes(projectFilter)) {
      setProjectFilter("all");
    }
  }, [projectFilter, projectFilterOptions]);

  const visibleItems = useMemo(() => {
    if (projectFilter === "all") {
      return ownerScopedItems;
    }

    if (projectFilter === "none") {
      return ownerScopedItems.filter((item) => !item.projectName?.trim());
    }

    return ownerScopedItems.filter((item) => item.projectName === projectFilter);
  }, [ownerScopedItems, projectFilter]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setSubmitError(null);
    setSelectedAttachments([]);
    setExistingAttachments([]);
    setExistingAttachmentsLoading(false);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = async (item: TaskProjectItem) => {
    setEditing(item);
    setErrors({});
    setSubmitError(null);
    setSelectedAttachments([]);
    setExistingAttachments([]);
    setExistingAttachmentsLoading(true);
    setForm({
      title: item.title,
      ownerGoogleId: item.ownerGoogleId,
      status: item.status,
      category: item.category,
      tags: item.tags?.join(", ") ?? "",
      description: item.description ?? "",
      projectName: item.projectName ?? "",
      newProjectName: "",
    });
    setModalOpen(true);

    try {
      const nextAttachments = await workItemsDataProvider.listAttachments(item.id);
      setExistingAttachments(nextAttachments);
    } catch {
      setExistingAttachments([]);
    } finally {
      setExistingAttachmentsLoading(false);
    }
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required";
    if (!form.ownerGoogleId.trim()) nextErrors.ownerGoogleId = "Owner is required";
    if (form.projectName === ADD_NEW_OPTION_VALUE && !form.newProjectName.trim()) {
      nextErrors.newProjectName = "Project name is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resolveProjectName = async (): Promise<string | undefined> => {
    if (form.projectName === ADD_NEW_OPTION_VALUE) {
      const created = await workItemsDataProvider.createTaskProjectOption(form.newProjectName.trim());
      const updatedOptions = await workItemsDataProvider.listTaskProjectOptions();
      setProjectOptions(updatedOptions);
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
      ownerGoogleId: selectedOwner.googleId,
      ownerEmail: selectedOwner.email,
      ownerName: getOwnerDisplayName(selectedOwner),
      status: form.status as TaskProjectStatus,
      category: form.category,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: form.description.trim() || undefined,
      projectName,
    };

    setSubmitError(null);

    try {
      const workItemId = editing
        ? (await workItemsDataProvider.updateWorkItem(editing.id, payload)).id
        : (await workItemsDataProvider.createWorkItem(payload)).id;

      const uploadResults = await Promise.allSettled(
        selectedAttachments.map((file) => workItemsDataProvider.uploadAttachment(workItemId, file)),
      );
      const failedUploads = uploadResults.filter((result) => result.status === "rejected").length;

      if (editing) {
        notify(failedUploads > 0 ? `Updated, but ${failedUploads} attachment(s) failed to upload` : "Updated");
      } else {
        notify(failedUploads > 0 ? `Created, but ${failedUploads} attachment(s) failed to upload` : "Created");
      }

      setModalOpen(false);
      setSelectedAttachments([]);
      await loadItems();
    } catch {
      setSubmitError("Could not save work item. Please review fields and try again.");
    }
  };

  const updateInline = async (id: string, patch: Partial<TaskProjectItem>) => {
    await workItemsDataProvider.updateWorkItem(id, patch);
    notify("Updated");
    await loadItems();
  };

  const handleComplete = async (id: string) => {
    await workItemsDataProvider.completeWorkItem(id);
    notify("Completed");
    await loadItems();
  };

  const handleDelete = async (id: string) => {
    await workItemsDataProvider.softDeleteWorkItem(id);
    notify("Deleted");
    await loadItems();
  };

  const handleRestore = async (id: string) => {
    await workItemsDataProvider.restoreWorkItem(id);
    notify("Restored");
    await loadItems();
  };

  const handleSelectAttachments = (files: FileList | null) => {
    if (!files) return;
    const nextFiles = Array.from(files);
    setSelectedAttachments((prev) => [...prev, ...nextFiles]);
  };

  const handleRemoveSelectedAttachment = (indexToRemove: number) => {
    setSelectedAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    try {
      await workItemsDataProvider.deleteAttachment(attachmentId);
      setExistingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
      notify("Attachment deleted");
    } catch {
      setSubmitError("Could not delete attachment. Please try again.");
    }
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
            <Select
              className="min-w-36"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={[
                { label: "All Projects", value: "all" },
                { label: "No Project", value: "none" },
                ...projectFilterOptions.map((projectName) => ({ label: projectName, value: projectName })),
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
              <div key={item.id} className="relative rounded-lg border border-slate-200 p-3">
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  {item.deleted ? <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Deleted</span> : null}
                  <Badge status={item.status} label={item.statusLabel} />
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 pr-28">
                  <div>
                    <div className="flex items-center gap-1">
                      <Link to={`/work-items/${item.id}`} className="cursor-pointer font-medium text-slate-900 hover:underline">
                        {item.title}
                      </Link>
                      {item.hasAttachments ? (
                        <span aria-label="Has attachments" title="Has attachments" className="text-sm text-slate-500">
                          📎
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.category === "downtime" ? "Downtime" : "Project"} • Owner {formatOwnerLabel(item, ownerOptionsByGoogleId.get(item.ownerGoogleId))} • Created {formatDate(item.createdAt)}
                    </p>
                    <p className="text-xs text-slate-500">Project: {item.projectName || "No Project"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 text-sm md:flex-row md:items-stretch">
                  <div className="min-w-0 md:flex-1">
                    <Select
                      className="w-full min-w-0"
                      options={TASK_PROJECT_STATUSES.map((status) => ({ label: status.label, value: status.key }))}
                      value={item.status}
                      disabled={!canManage}
                      onChange={(e) => void updateInline(item.id, { status: e.target.value as TaskProjectStatus })}
                    />
                  </div>
                  <div className="min-w-0 md:flex-1">
                    <Select
                      className="w-full min-w-0"
                      options={mergedItemOwnerOptions.map((owner) => ({ label: getOwnerDisplayName(owner), value: owner.googleId }))}
                      value={item.ownerGoogleId}
                      disabled={!canManage}
                      onChange={(e) => {
                        const nextOwner = ownerOptions.find((owner) => owner.googleId === e.target.value);
                        if (!nextOwner) return;
                        void updateInline(item.id, { ownerGoogleId: nextOwner.googleId, ownerEmail: nextOwner.email, ownerName: getOwnerDisplayName(nextOwner) });
                      }}
                    />
                  </div>
                  <Button className="md:w-auto md:min-w-24 md:flex-none" variant="secondary" onClick={() => void openEdit(item)} disabled={!canManage}>
                    Edit
                  </Button>
                  {item.deleted && canRestore ? (
                    <Button className="md:w-auto md:min-w-24 md:flex-none" variant="secondary" onClick={() => void handleRestore(item.id)}>
                      Restore
                    </Button>
                  ) : (
                    <Button className="md:w-auto md:min-w-24 md:flex-none" onClick={() => void handleComplete(item.id)} disabled={!canManage || item.deleted || item.status === "completed"}>
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
          <Select label="Owner" value={form.ownerGoogleId} error={errors.ownerGoogleId} options={[{ label: "Select owner", value: "" }, ...mergedItemOwnerOptions.map((owner) => ({ label: getOwnerDisplayName(owner), value: owner.googleId }))]} onChange={(e) => setForm({ ...form, ownerGoogleId: e.target.value })} />
          <Select label="Status" value={form.status} options={TASK_PROJECT_STATUSES.map((status) => ({ label: status.label, value: status.key }))} onChange={(e) => setForm({ ...form, status: e.target.value as TaskProjectStatus })} />
          <Select
            label="Project"
            value={form.projectName}
            options={[
              { label: "No Project", value: "" },
              ...modalProjectOptions.map((projectName) => ({ label: projectName, value: projectName })),
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
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Attachments (Optional)</span>
            {isDemoMode ? <DemoAttachmentNote /> : null}
            <input
              type="file"
              multiple
              className="block w-full text-sm"
              onChange={(e) => {
                handleSelectAttachments(e.target.files);
                e.target.value = "";
              }}
            />
            {selectedAttachments.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {selectedAttachments.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-rose-700 hover:text-rose-800"
                      onClick={() => handleRemoveSelectedAttachment(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          {editing ? (
            <div className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Existing Attachments</span>
              {existingAttachmentsLoading ? (
                <p className="text-xs text-slate-500">Loading attachments...</p>
              ) : existingAttachments.length === 0 ? (
                <p className="text-xs text-slate-500">No attachments.</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {existingAttachments.map((attachment) => (
                    <li key={attachment.id} className="flex items-center gap-2">
                      <span className="truncate">{attachment.filename}</span>
                      <button
                        type="button"
                        className="shrink-0 text-sm text-rose-600 hover:text-rose-800"
                        title="Delete attachment"
                        onClick={() => void handleDeleteExistingAttachment(attachment.id)}
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        {submitError ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{submitError}</div>
        ) : null}
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

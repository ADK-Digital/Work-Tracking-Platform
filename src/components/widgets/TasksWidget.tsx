import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TASK_PROJECT_STATUSES,
  type SortOption,
  type TaskProjectItem,
  type TaskProjectStatus
} from "../../types/workItem";
import { workItemsService } from "../../services/workItemsService";
import { WidgetCard } from "./WidgetCard";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { formatDate } from "../../utils/dates";
import { useToast } from "../ui/Toast";

type Filter = "all" | "open" | "closed" | string;

type FormState = {
  title: string;
  requester: string;
  owner: string;
  status: TaskProjectStatus;
  category: "downtime" | "project";
  tags: string;
  description: string;
};

const defaultForm: FormState = {
  title: "",
  requester: "",
  owner: "",
  status: "Backlog",
  category: "project",
  tags: "",
  description: ""
};

const owners = ["Avery Tran", "Noah Diaz", "Kira James", "Riley Fox"];

export const TasksWidget = ({
  resetSignal,
  canManage,
  includeDeleted = false,
  canRestore = false
}: {
  resetSignal: number;
  canManage: boolean;
  includeDeleted?: boolean;
  canRestore?: boolean;
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

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await workItemsService.getWorkItems({ type: "task_project", statusFilter: filter, sort, includeDeleted });
      setItems(data as TaskProjectItem[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [filter, sort, resetSignal, includeDeleted]);

  const filterOptions = useMemo(
    () => [
      { label: "All", value: "all" },
      { label: "Open", value: "open" },
      { label: "Closed", value: "closed" },
      ...TASK_PROJECT_STATUSES.map((status) => ({ label: status, value: status }))
    ],
    []
  );

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
      owner: item.owner,
      status: item.status,
      category: item.category,
      tags: item.tags?.join(", ") ?? "",
      description: item.description ?? ""
    });
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required";
    if (!form.requester.trim()) nextErrors.requester = "Requester is required";
    if (!form.owner.trim()) nextErrors.owner = "Owner is required";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload = {
      type: "task_project" as const,
      title: form.title.trim(),
      requester: form.requester.trim(),
      owner: form.owner.trim(),
      status: form.status as TaskProjectStatus,
      category: form.category,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: form.description.trim() || undefined
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
        subtitle="Manage downtime fixes and strategic projects"
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
                { label: "Status Priority", value: "status_priority" }
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
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No items match your filters</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/work-items/${item.id}`} className="cursor-pointer font-medium text-slate-900 hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {item.category === "downtime" ? "Downtime" : "Project"} • Owner {item.owner} • Created {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.deleted ? <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Deleted</span> : null}
                    <Badge status={item.status} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
                  <Select
                    options={TASK_PROJECT_STATUSES.map((status) => ({ label: status, value: status }))}
                    value={item.status}
                    disabled={!canManage}
                    onChange={(e) => void updateInline(item.id, { status: e.target.value as TaskProjectStatus })}
                  />
                  <Select
                    options={owners.map((owner) => ({ label: owner, value: owner }))}
                    value={item.owner}
                    disabled={!canManage}
                    onChange={(e) => void updateInline(item.id, { owner: e.target.value })}
                  />
                  <Button variant="secondary" onClick={() => openEdit(item)} disabled={!canManage}>
                    Edit
                  </Button>
                  {item.deleted && canRestore ? (
                    <Button variant="secondary" onClick={() => void handleRestore(item.id)}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={() => void handleDelete(item.id)} disabled={!canManage}>
                      Delete
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
          <Input label="Owner" value={form.owner} error={errors.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <Select label="Status" value={form.status} options={TASK_PROJECT_STATUSES.map((status) => ({ label: status, value: status }))} onChange={(e) => setForm({ ...form, status: e.target.value as TaskProjectStatus })} />
          <Select
            label="Category"
            value={form.category}
            options={[
              { label: "Project", value: "project" },
              { label: "Downtime", value: "downtime" }
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
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canManage}>{editing ? "Save Changes" : "Create"}</Button>
        </div>
      </Modal>
    </>
  );
};

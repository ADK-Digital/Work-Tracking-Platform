import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";
import { workItemsService } from "../services/workItemsService";
import {
  PURCHASE_REQUEST_STATUSES,
  TASK_PROJECT_STATUSES,
  type ActivityEvent,
  type PurchaseRequestItem,
  type TaskProjectItem,
  type WorkItem
} from "../types/workItem";
import { formatDate, formatDateTime } from "../utils/dates";

interface WorkItemDetailPageProps {
  onReset: () => void;
  resetting: boolean;
}

type FormState = {
  title: string;
  description: string;
  status: WorkItem["status"];
  owner: string;
};

export const WorkItemDetailPage = ({ onReset, resetting }: WorkItemDetailPageProps) => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<WorkItem | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ title: "", description: "", status: "New", owner: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { notify } = useToast();

  const statusOptions = useMemo(
    () =>
      (item?.type === "purchase_request" ? PURCHASE_REQUEST_STATUSES : TASK_PROJECT_STATUSES).map((status) => ({
        label: status,
        value: status
      })),
    [item?.type]
  );

  const loadItemAndActivity = async () => {
    if (!id) {
      setItem(null);
      setActivity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [found, events] = await Promise.all([workItemsService.getWorkItemById(id), workItemsService.listActivity(id)]);
      setItem(found);
      setActivity(events);
    } catch {
      setItem(null);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItemAndActivity();
  }, [id]);

  const openEdit = () => {
    if (!item) return;

    setErrors({});
    setForm({
      title: item.title,
      description: item.description ?? "",
      status: item.status,
      owner: item.owner
    });
    setEditOpen(true);
  };

  const submit = async () => {
    if (!item) return;

    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required";
    if (!form.owner.trim()) nextErrors.owner = "Owner is required";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await workItemsService.updateWorkItem(item.id, {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status as WorkItem["status"],
      owner: form.owner.trim()
    });

    notify("Updated");
    setEditOpen(false);
    await loadItemAndActivity();
  };

  return (
    <AppShell onReset={onReset} resetting={resetting}>
      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : !item ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-base font-medium text-slate-900">Work item not found</p>
          <p className="mt-2 text-sm text-slate-500">The item may have been deleted or never existed.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-slate-700 underline hover:text-slate-900">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Link to="/" className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
              ← Back to dashboard
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {item.type === "purchase_request" ? "Purchase Request" : "Task / Project"}
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
              </div>
              <Badge status={item.status} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Owner</p>
                <p className="mt-1 text-sm text-slate-800">{item.owner}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Requester</p>
                <p className="mt-1 text-sm text-slate-800">{item.requester}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</p>
                <p className="mt-1 text-sm text-slate-800">{formatDate(item.createdAt)}</p>
              </div>
              {item.type === "purchase_request" ? (
                <>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vendor</p>
                    <p className="mt-1 text-sm text-slate-800">{(item as PurchaseRequestItem).vendor}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount</p>
                    <p className="mt-1 text-sm text-slate-800">${(item as PurchaseRequestItem).amount.toLocaleString()}</p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Category</p>
                  <p className="mt-1 text-sm text-slate-800">
                    {(item as TaskProjectItem).category === "downtime" ? "Downtime" : "Project"}
                  </p>
                </div>
              )}
              {item.description ? (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.description}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <Button variant="secondary" onClick={openEdit}>
                Edit
              </Button>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-base font-semibold text-slate-900">Activity Log</h3>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activity.map((event) => (
                  <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-800">{event.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(event.timestamp)}{event.actor ? ` · ${event.actor}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Modal title="Edit Work Item" open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Title"
            value={form.title}
            error={errors.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            label="Owner"
            value={form.owner}
            error={errors.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
          />
          <Select
            label="Status"
            value={form.status}
            options={statusOptions}
            onChange={(e) => setForm({ ...form, status: e.target.value as WorkItem["status"] })}
          />
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
          <Button variant="secondary" onClick={() => setEditOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Save Changes</Button>
        </div>
      </Modal>
    </AppShell>
  );
};

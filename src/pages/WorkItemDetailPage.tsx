import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";
import { type AuthUser, loadAuthUser } from "../services/authService";
import { API_FORBIDDEN_EVENT, isApiModeEnabled, workItemsService } from "../services/workItemsService";
import {
  PURCHASE_REQUEST_STATUSES,
  TASK_PROJECT_STATUSES,
  type ActivityEvent,
  type Comment,
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [forbiddenWarning, setForbiddenWarning] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", description: "", status: "New", owner: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { notify } = useToast();
  const canManage = !isApiModeEnabled || authUser?.role === "admin";
  const canViewDeleted = isApiModeEnabled && authUser?.role === "admin";
  const canComment = !isApiModeEnabled || Boolean(authUser);
  const isAdmin = !isApiModeEnabled || authUser?.role === "admin";

  const statusOptions = useMemo(
    () =>
      (item?.type === "purchase_request" ? PURCHASE_REQUEST_STATUSES : TASK_PROJECT_STATUSES).map((status) => ({
        label: status,
        value: status
      })),
    [item?.type]
  );

  const loadItemActivityAndComments = async () => {
    if (!id) {
      setItem(null);
      setActivity([]);
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [found, events, nextComments] = await Promise.all([
        workItemsService.getWorkItemById(id, { includeDeleted: canViewDeleted }),
        workItemsService.listActivity(id),
        workItemsService.listComments(id)
      ]);
      setItem(found);
      setActivity(events);
      setComments(nextComments);
    } catch {
      setItem(null);
      setActivity([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItemActivityAndComments();
  }, [id, canViewDeleted]);

  useEffect(() => {
    const loadMe = async () => {
      if (!isApiModeEnabled) {
        return;
      }

      try {
        const me = await loadAuthUser();
        setAuthUser(me);
      } catch {
        setAuthUser(null);
      }
    };

    void loadMe();

    const handleForbidden = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setForbiddenWarning(customEvent.detail);
    };

    window.addEventListener(API_FORBIDDEN_EVENT, handleForbidden);

    return () => {
      window.removeEventListener(API_FORBIDDEN_EVENT, handleForbidden);
    };
  }, []);

  const handleAddComment = async () => {
    if (!item) return;

    const trimmedBody = commentBody.trim();
    if (!trimmedBody) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    if (trimmedBody.length > 5000) {
      setCommentError("Comment must be 5000 characters or fewer.");
      return;
    }

    setCommentError(null);

    try {
      await workItemsService.addComment(item.id, trimmedBody);
      setCommentBody("");
      notify("Comment added");
      await loadItemActivityAndComments();
    } catch {
      setCommentError("Could not add comment. Please try again.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) {
      return;
    }

    try {
      await workItemsService.softDeleteComment(commentId);
      notify("Comment deleted");
      await loadItemActivityAndComments();
    } catch {
      setCommentError("Could not delete comment. Please try again.");
    }
  };

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
    await loadItemActivityAndComments();
  };

  const handleRestore = async () => {
    if (!item) return;

    await workItemsService.restoreWorkItem(item.id);
    notify("Restored");
    await loadItemActivityAndComments();
  };

  return (
    <AppShell onReset={onReset} resetting={resetting}>
      {isApiModeEnabled && forbiddenWarning ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{forbiddenWarning}</div>
      ) : null}
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
              <div className="flex items-center gap-2">
                {item.deleted ? <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Deleted</span> : null}
                <Badge status={item.status} />
              </div>
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

            <div className="mt-6 flex items-center gap-2">
              <Button variant="secondary" onClick={openEdit} disabled={!canManage || item.deleted}>
                Edit
              </Button>
              {item.deleted && canManage ? (
                <Button variant="secondary" onClick={() => void handleRestore()}>
                  Restore
                </Button>
              ) : null}
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

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-base font-semibold text-slate-900">Comments</h3>
            {commentError ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{commentError}</div>
            ) : null}

            {comments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No comments yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        {comment.authorName || comment.authorEmail} · {formatDateTime(comment.createdAt)}
                      </p>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(comment.id)}
                          className="text-xs text-rose-700 underline hover:text-rose-800"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}

            {canComment ? (
              <div className="mt-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Add a comment</span>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    value={commentBody}
                    maxLength={5000}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                </label>
                <div className="mt-2 flex justify-end">
                  <Button onClick={() => void handleAddComment()} disabled={!commentBody.trim()}>
                    Add comment
                  </Button>
                </div>
              </div>
            ) : null}
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
            disabled={!canManage}
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
          <Button onClick={() => void submit()} disabled={!canManage}>Save Changes</Button>
        </div>
      </Modal>
    </AppShell>
  );
};

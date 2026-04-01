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
import { API_FORBIDDEN_EVENT, workItemsService } from "../services/workItemsService";
import { loadOwnerDirectory, type OwnerDirectoryEntry } from "../services/ownerDirectoryService";
import {
  PURCHASE_REQUEST_STATUSES,
  TASK_PROJECT_STATUSES,
  type ActivityEvent,
  type Comment,
  type Attachment,
  type PurchaseRequestItem,
  type TaskProjectItem,
  type WorkItem,
  type TaskProjectOption
} from "../types/workItem";
import { formatDate, formatDateTime } from "../utils/dates";
import { formatOwnerLabel } from "../utils/owners";

type FormState = {
  title: string;
  description: string;
  status: WorkItem["status"];
  ownerGoogleId: string;
  projectName: string;
  newProjectName: string;
};

export const WorkItemDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<WorkItem | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [editSelectedAttachments, setEditSelectedAttachments] = useState<File[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [forbiddenWarning, setForbiddenWarning] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", description: "", status: "submitted", ownerGoogleId: "", projectName: "", newProjectName: "" });
  const [ownerOptions, setOwnerOptions] = useState<OwnerDirectoryEntry[]>([]);
  const [projectOptions, setProjectOptions] = useState<TaskProjectOption[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { notify } = useToast();
  const canManage = authUser?.role === "admin";
  const canViewDeleted = authUser?.role === "admin";
  const canComment = Boolean(authUser);
  const canManageAttachments = Boolean(authUser);
  const isAdmin = authUser?.role === "admin";

  const statusOptions = useMemo(
    () =>
      (item?.type === "purchase_request" ? PURCHASE_REQUEST_STATUSES : TASK_PROJECT_STATUSES).map((status) => ({
        label: status.label,
        value: status.key
      })),
    [item?.type]
  );

  const loadItemActivityAndComments = async () => {
    if (!id) {
      setItem(null);
      setActivity([]);
      setComments([]);
      setAttachments([]);
      setAttachments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [found, events, nextComments, nextAttachments] = await Promise.all([
        workItemsService.getWorkItemById(id, { includeDeleted: canViewDeleted }),
        workItemsService.listActivity(id),
        workItemsService.listComments(id),
        workItemsService.listAttachments(id)
      ]);
      setItem(found);
      setActivity(events);
      setComments(nextComments);
      setAttachments(nextAttachments);
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
      try {
        const me = await loadAuthUser();
        setAuthUser(me);
      } catch {
        setAuthUser(null);
      }
    };

    void loadMe();
    void loadOwnerDirectory().then((response) => setOwnerOptions(response.owners)).catch(() => setOwnerOptions([]));
    void workItemsService.listTaskProjectOptions().then(setProjectOptions).catch(() => setProjectOptions([]));

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



  const handleUploadAttachment = async () => {
    if (!item || attachmentFiles.length === 0) {
      return;
    }

    setAttachmentError(null);
    setUploadingAttachment(true);
    try {
      const uploadResults = await Promise.allSettled(
        attachmentFiles.map((file) => workItemsService.uploadAttachment(item.id, file)),
      );
      const failedUploads = uploadResults.filter((result) => result.status === "rejected").length;
      setAttachmentFiles([]);
      notify(failedUploads > 0 ? `Uploaded, but ${failedUploads} attachment(s) failed` : "Attachment uploaded");
      await loadItemActivityAndComments();
    } catch {
      setAttachmentError("Could not upload attachment. Please check file size/type and try again.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!window.confirm("Delete this attachment?")) {
      return;
    }

    try {
      await workItemsService.deleteAttachment(attachmentId);
      notify("Attachment deleted");
      await loadItemActivityAndComments();
    } catch {
      setAttachmentError("Could not delete attachment. Please try again.");
    }
  };

  const handleSelectAttachmentFiles = (files: FileList | null) => {
    if (!files) return;
    setAttachmentFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const handleRemoveAttachmentFile = (indexToRemove: number) => {
    setAttachmentFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSelectEditAttachments = (files: FileList | null) => {
    if (!files) return;
    setEditSelectedAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const handleRemoveEditSelectedAttachment = (indexToRemove: number) => {
    setEditSelectedAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
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
    setEditSubmitError(null);
    setEditSelectedAttachments([]);
    setForm({
      title: item.title,
      description: item.description ?? "",
      status: item.status,
      ownerGoogleId: item.ownerGoogleId,
      projectName: item.type === "task_project" ? item.projectName ?? "" : "",
      newProjectName: "",
    });
    setEditOpen(true);
  };

  const submit = async () => {
    if (!item) return;

    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required";
    if (!form.ownerGoogleId.trim()) nextErrors.ownerGoogleId = "Owner is required";
    if (item.type === "task_project" && form.projectName === "__add_new_project__" && !form.newProjectName.trim()) {
      nextErrors.newProjectName = "Project name is required";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    let resolvedProjectName: string | undefined;
    if (item.type === "task_project") {
      if (form.projectName === "__add_new_project__") {
        const created = await workItemsService.createTaskProjectOption(form.newProjectName.trim());
        resolvedProjectName = created.name;
        const options = await workItemsService.listTaskProjectOptions();
        setProjectOptions(options);
      } else {
        resolvedProjectName = form.projectName.trim() || undefined;
      }
    }

    setEditSubmitError(null);

    try {
      await workItemsService.updateWorkItem(item.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status as WorkItem["status"],
        ...(item.type === "task_project" ? { projectName: resolvedProjectName } : {}),
        ...(ownerOptions.find((owner) => owner.googleId === form.ownerGoogleId)
          ? {
              ownerGoogleId: form.ownerGoogleId,
              ownerEmail: ownerOptions.find((owner) => owner.googleId === form.ownerGoogleId)!.email,
              ownerName: ownerOptions.find((owner) => owner.googleId === form.ownerGoogleId)!.email
            }
          : {})
      });

      const uploadResults = await Promise.allSettled(
        editSelectedAttachments.map((file) => workItemsService.uploadAttachment(item.id, file)),
      );
      const failedUploads = uploadResults.filter((result) => result.status === "rejected").length;

      notify(failedUploads > 0 ? `Updated, but ${failedUploads} attachment(s) failed to upload` : "Updated");
      setEditOpen(false);
      setEditSelectedAttachments([]);
      await loadItemActivityAndComments();
    } catch {
      setEditSubmitError("Could not update work item. Please review fields and try again.");
    }
  };

  const handleRestore = async () => {
    if (!item) return;

    await workItemsService.restoreWorkItem(item.id);
    notify("Restored");
    await loadItemActivityAndComments();
  };

  return (
    <AppShell authUser={authUser}>
      {forbiddenWarning ? (
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
                <Badge status={item.status} label={item.statusLabel} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Owner</p>
                <p className="mt-1 text-sm text-slate-800">{formatOwnerLabel(item)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Requestor</p>
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
                <>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Category</p>
                    <p className="mt-1 text-sm text-slate-800">
                      {(item as TaskProjectItem).category === "downtime" ? "Downtime" : "Project"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</p>
                    <p className="mt-1 text-sm text-slate-800">{(item as TaskProjectItem).projectName || "No Project"}</p>
                  </div>
                </>
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

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-base font-semibold text-slate-900">Attachments</h3>
            {attachmentError ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{attachmentError}</div>
            ) : null}

            {attachments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No attachments yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <a
                          className="text-sm font-medium text-slate-800 underline hover:text-slate-900"
                          href={workItemsService.getAttachmentDownloadUrl(attachment.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {attachment.filename}
                        </a>
                        <p className="mt-1 text-xs text-slate-500">
                          {(attachment.sizeBytes / 1024).toFixed(1)} KB · {attachment.uploadedBy} · {formatDateTime(attachment.uploadedAt)}
                        </p>
                      </div>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteAttachment(attachment.id)}
                          className="text-xs text-rose-700 underline hover:text-rose-800"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canManageAttachments ? (
              <div className="mt-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Upload attachment</span>
                  <input
                    type="file"
                    multiple
                    className="block w-full text-sm"
                    onChange={(e) => handleSelectAttachmentFiles(e.target.files)}
                  />
                </label>
                {attachmentFiles.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-500">
                    {attachmentFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-rose-700 underline hover:text-rose-800"
                          onClick={() => handleRemoveAttachmentFile(index)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-2 flex justify-end">
                  <Button onClick={() => void handleUploadAttachment()} disabled={attachmentFiles.length === 0 || uploadingAttachment}>
                    {uploadingAttachment ? "Uploading..." : "Upload"}
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
          <Select
            label="Owner"
            value={form.ownerGoogleId}
            error={errors.ownerGoogleId}
            options={[{ label: "Select owner", value: "" }, ...ownerOptions.map((owner) => ({ label: owner.email, value: owner.googleId }))]}
            onChange={(e) => setForm({ ...form, ownerGoogleId: e.target.value })}
          />
          <Select
            label="Status"
            value={form.status}
            options={statusOptions}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, status: e.target.value as WorkItem["status"] })}
          />
          {item?.type === "task_project" ? (
            <>
              <Select
                label="Project"
                value={form.projectName}
                options={[
                  { label: "No Project", value: "" },
                  ...projectOptions.map((option) => ({ label: option.name, value: option.name })),
                  { label: "Add New...", value: "__add_new_project__" },
                ]}
                onChange={(e) => setForm({ ...form, projectName: e.target.value, newProjectName: e.target.value === "__add_new_project__" ? form.newProjectName : "" })}
              />
              {form.projectName === "__add_new_project__" ? (
                <Input
                  label="New Project Name"
                  value={form.newProjectName}
                  error={errors.newProjectName}
                  onChange={(e) => setForm({ ...form, newProjectName: e.target.value })}
                />
              ) : null}
            </>
          ) : null}
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
            <input
              type="file"
              multiple
              className="block w-full text-sm"
              onChange={(e) => handleSelectEditAttachments(e.target.files)}
            />
            {editSelectedAttachments.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {editSelectedAttachments.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-rose-700 hover:text-rose-800"
                      onClick={() => handleRemoveEditSelectedAttachment(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <div className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Existing Attachments</span>
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-500">No attachments.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-700">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-2">
                    <span className="truncate">{attachment.filename}</span>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="shrink-0 text-sm text-rose-600 hover:text-rose-800"
                        title="Delete attachment"
                        onClick={() => void handleDeleteAttachment(attachment.id)}
                      >
                        🗑
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {editSubmitError ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{editSubmitError}</div>
        ) : null}
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

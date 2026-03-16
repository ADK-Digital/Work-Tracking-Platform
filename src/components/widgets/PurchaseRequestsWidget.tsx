import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PURCHASE_REQUEST_STATUSES,
  type PurchaseRequestItem,
  type PurchaseRequestStatus,
  type SortOption
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
import { formatOwnerLabel, getOwnerDisplayName } from "../../utils/owners";

type Filter = "all" | string;

type FormState = {
  title: string;
  requester: string;
  ownerGoogleId: string;
  status: PurchaseRequestStatus;
  vendor: string;
  amount: string;
  budgetCode: string;
  poNumber: string;
  description: string;
};

const defaultForm: FormState = {
  title: "",
  requester: "",
  ownerGoogleId: "",
  status: "submitted",
  vendor: "",
  amount: "",
  budgetCode: "",
  poNumber: "",
  description: ""
};


export const PurchaseRequestsWidget = ({
  resetSignal,
  canManage,
  includeDeleted = false,
  canRestore = false,
  selectedOwnerIdentity = null
}: {
  resetSignal: number;
  canManage: boolean;
  includeDeleted?: boolean;
  canRestore?: boolean;
  selectedOwnerIdentity?: OwnerIdentity | null;
}) => {
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortOption>("status_priority");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequestItem | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { notify } = useToast();
  const [ownerOptions, setOwnerOptions] = useState<OwnerDirectoryEntry[]>([]);

  const ownerOptionsByGoogleId = useMemo(
    () => new Map(ownerOptions.map((owner) => [owner.googleId, owner])),
    [ownerOptions],
  );

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await workItemsService.getWorkItems({
        type: "purchase_request",
        statusFilter: filter,
        sort,
        includeDeleted
      });
      setItems(data as PurchaseRequestItem[]);
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
      ...PURCHASE_REQUEST_STATUSES.map((status) => ({ label: status.label, value: status.key }))
    ],
    []
  );

  const visibleItems = useMemo(() => {
    if (!selectedOwnerIdentity) {
      return items;
    }

    return items.filter((item) => workItemMatchesOwnerIdentity(item, selectedOwnerIdentity));
  }, [items, selectedOwnerIdentity]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (item: PurchaseRequestItem) => {
    setEditing(item);
    setErrors({});
    setForm({
      title: item.title,
      requester: item.requester,
      ownerGoogleId: item.ownerGoogleId,
      status: item.status,
      vendor: item.vendor,
      amount: String(item.amount),
      budgetCode: item.budgetCode,
      poNumber: item.poNumber ?? "",
      description: item.description ?? ""
    });
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required";
    if (!form.requester.trim()) nextErrors.requester = "Requester is required";
    if (!form.ownerGoogleId.trim()) nextErrors.ownerGoogleId = "Owner is required";
    if (!form.vendor.trim()) nextErrors.vendor = "Vendor is required";
    if (!form.budgetCode.trim()) nextErrors.budgetCode = "Budget code is required";
    if (!form.amount || Number.isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      nextErrors.amount = "Amount must be a positive number";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const selectedOwner = ownerOptions.find((owner) => owner.googleId === form.ownerGoogleId);
    if (!selectedOwner) {
      setErrors((prev) => ({ ...prev, ownerGoogleId: "Owner is required" }));
      return;
    }

    const payload = {
      type: "purchase_request" as const,
      title: form.title.trim(),
      requester: form.requester.trim(),
      ownerGoogleId: selectedOwner.googleId,
      ownerEmail: selectedOwner.email,
      ownerName: getOwnerDisplayName(selectedOwner),
      status: form.status as PurchaseRequestStatus,
      vendor: form.vendor.trim(),
      amount: Number(form.amount),
      budgetCode: form.budgetCode.trim(),
      poNumber: form.poNumber.trim() || undefined,
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

  const updateInline = async (id: string, patch: Partial<PurchaseRequestItem>) => {
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
        title="Purchase Requests"
        subtitle="Track procurement flow and ownership"
        controls={
          <div className="flex flex-wrap gap-2">
            <Select
              className="min-w-32"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={filterOptions}
            />
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
                    <Link to={`/work-items/${item.id}`} className="cursor-pointer font-medium text-slate-900 hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {item.vendor} • ${item.amount.toLocaleString()} • Owner {formatOwnerLabel(item, ownerOptionsByGoogleId.get(item.ownerGoogleId))} • Created {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 text-sm md:flex-row md:items-stretch">
                  <div className="min-w-0 md:flex-1">
                    <Select
                      className="w-full min-w-0"
                      options={PURCHASE_REQUEST_STATUSES.map((status) => ({ label: status.label, value: status.key }))}
                      value={item.status}
                      disabled={!canManage}
                      onChange={(e) => void updateInline(item.id, { status: e.target.value as PurchaseRequestStatus })}
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
                  <Button className="md:w-auto md:min-w-24 md:flex-none" variant="secondary" onClick={() => openEdit(item)} disabled={!canManage}>
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

      <Modal
        title={editing ? "Edit Purchase Request" : "Add Purchase Request"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Title" value={form.title} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Requester" value={form.requester} error={errors.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} />
          <Select label="Owner" value={form.ownerGoogleId} error={errors.ownerGoogleId} options={[{ label: "Select owner", value: "" }, ...mergedItemOwnerOptions.map((owner) => ({ label: getOwnerDisplayName(owner), value: owner.googleId }))]} onChange={(e) => setForm({ ...form, ownerGoogleId: e.target.value })} />
          <Select label="Status" value={form.status} options={PURCHASE_REQUEST_STATUSES.map((status) => ({ label: status.label, value: status.key }))} onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseRequestStatus })} />
          <Input label="Vendor" value={form.vendor} error={errors.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          <Input label="Amount" value={form.amount} error={errors.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Budget Code" value={form.budgetCode} error={errors.budgetCode} onChange={(e) => setForm({ ...form, budgetCode: e.target.value })} />
          <Input label="PO Number (Optional)" value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
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

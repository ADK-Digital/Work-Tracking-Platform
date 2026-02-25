import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PurchaseRequestsWidget } from "../components/widgets/PurchaseRequestsWidget";
import { TasksWidget } from "../components/widgets/TasksWidget";
import { ApiError, apiFetch } from "../services/http";
import { type AuthUser, loadAuthUser } from "../services/authService";
import { API_ERROR_EVENT, API_FORBIDDEN_EVENT, API_UNAUTHORIZED_EVENT, isApiModeEnabled, workItemsService } from "../services/workItemsService";
import { PURCHASE_REQUEST_STATUSES, TASK_PROJECT_STATUSES, type SearchResult } from "../types/workItem";

interface DashboardProps {
  onReset: () => void;
  resetting: boolean;
  resetSignal: number;
}

export const Dashboard = ({ onReset, resetting, resetSignal }: DashboardProps) => {
  const [apiError, setApiError] = useState<string | null>(null);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [forbiddenWarning, setForbiddenWarning] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "purchase_request" | "task_project">("all");
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchOwner, setSearchOwner] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  const canManage = !isApiModeEnabled || authUser?.role === "admin";
  const canUseDeletedFeatures = isApiModeEnabled && authUser?.role === "admin";

  const loadMe = async () => {
    if (!isApiModeEnabled) {
      return;
    }

    try {
      const me = await loadAuthUser();
      setAuthUser(me);
      setAuthWarning(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthUser(null);
        return;
      }

      console.error(error);
    }
  };

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" });
    setAuthUser(null);
    setAuthWarning("Please sign in to continue");
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = queryInput.trim();
    setActiveQuery(nextQuery);

    if (!nextQuery) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const nextResults = await workItemsService.searchWorkItems(nextQuery, {
        type: searchType === "all" ? undefined : searchType,
        status: searchStatus === "all" ? undefined : searchStatus,
        owner: searchOwner === "all" ? undefined : searchOwner,
        includeDeleted: canUseDeletedFeatures ? showDeleted : false,
        limit: 50,
      });
      setResults(nextResults);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    void loadMe();

    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setApiError(customEvent.detail);
    };
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setAuthUser(null);
      setAuthWarning(customEvent.detail);
    };
    const handleForbidden = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setForbiddenWarning(customEvent.detail);
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError);
    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(API_FORBIDDEN_EVENT, handleForbidden);

    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(API_FORBIDDEN_EVENT, handleForbidden);
    };
  }, []);

  useEffect(() => {
    const loadOwners = async () => {
      const [purchaseItems, taskItems] = await Promise.all([
        workItemsService.getWorkItems({ type: "purchase_request", includeDeleted: canUseDeletedFeatures ? showDeleted : false }),
        workItemsService.getWorkItems({ type: "task_project", includeDeleted: canUseDeletedFeatures ? showDeleted : false }),
      ]);

      const uniqueOwners = new Set<string>();
      [...purchaseItems, ...taskItems].forEach((item) => {
        if (item.owner && item.owner !== "Unassigned") {
          uniqueOwners.add(item.owner);
        }
      });

      setOwners([...uniqueOwners].sort((a, b) => a.localeCompare(b)));
    };

    void loadOwners();
  }, [canUseDeletedFeatures, showDeleted, resetSignal]);

  const searchingViewEnabled = activeQuery.length > 0;

  const statusOptions = useMemo(() => {
    const allStatuses = [...PURCHASE_REQUEST_STATUSES, ...TASK_PROJECT_STATUSES];
    return ["all", ...new Set(allStatuses)];
  }, []);

  return (
    <AppShell
      onReset={onReset}
      resetting={resetting}
      showAuthControls={isApiModeEnabled}
      authUser={authUser}
      onSignOut={signOut}
    >
      {isApiModeEnabled && authWarning ? (
        <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">{authWarning}</div>
      ) : null}
      {isApiModeEnabled && apiError ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {apiError}
        </div>
      ) : null}
      {isApiModeEnabled && forbiddenWarning ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{forbiddenWarning}</div>
      ) : null}

      <form onSubmit={handleSearch} className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Search</span>
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Find by keyword, UUID, or YYYY-MM-DD"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Type</span>
            <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="all">All</option>
              <option value="purchase_request">Purchase Request</option>
              <option value="task_project">Task/Project</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select value={searchStatus} onChange={(event) => setSearchStatus(event.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All" : status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Owner</span>
            <select value={searchOwner} onChange={(event) => setSearchOwner(event.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="all">All</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">Search</button>
        </div>
        {canUseDeletedFeatures ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              id="show-deleted"
              type="checkbox"
              checked={showDeleted}
              onChange={(event) => setShowDeleted(event.target.checked)}
            />
            <label htmlFor="show-deleted">Include deleted items/comments</label>
          </div>
        ) : null}
      </form>

      {searchingViewEnabled ? (
        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Search Results</h2>
          {searching ? <p className="text-sm text-slate-600">Searching…</p> : null}
          {!searching && results.length === 0 ? <p className="text-sm text-slate-600">No matches found.</p> : null}
          {!searching && results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((result, index) => {
                const workItemId = result.kind === "workItem" ? result.workItem.id : result.workItemId;
                const label =
                  result.kind === "workItem"
                    ? "Work Item"
                    : result.kind === "comment"
                      ? "Comment"
                      : result.kind === "activity"
                        ? "Activity"
                        : "Attachment";
                const title =
                  result.kind === "workItem"
                    ? result.workItem.title
                    : result.kind === "comment"
                      ? result.comment.body
                      : result.kind === "activity"
                        ? result.activity.message
                        : result.attachment.filename;

                return (
                  <li key={`${result.kind}-${workItemId}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                    <Link className="text-sm font-medium text-blue-700 hover:underline" to={`/work-items/${workItemId}`}>
                      {title}
                    </Link>
                    {result.snippet ? <p className="mt-1 text-sm text-slate-600">{result.snippet}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">Matched: {result.matchedFields.join(", ")}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {!searchingViewEnabled ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PurchaseRequestsWidget
            resetSignal={resetSignal}
            canManage={canManage}
            includeDeleted={showDeleted}
            canRestore={canUseDeletedFeatures}
          />
          <TasksWidget
            resetSignal={resetSignal}
            canManage={canManage}
            includeDeleted={showDeleted}
            canRestore={canUseDeletedFeatures}
          />
        </div>
      ) : null}
    </AppShell>
  );
};

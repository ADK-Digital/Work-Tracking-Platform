import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PurchaseRequestsWidget } from "../components/widgets/PurchaseRequestsWidget";
import { TasksWidget } from "../components/widgets/TasksWidget";
import { ApiError, apiFetch } from "../services/http";
import { type AuthUser, loadAuthUser } from "../services/authService";
import { loadOwnerDirectory, type OwnerDirectoryEntry } from "../services/ownerDirectoryService";
import { API_ERROR_EVENT, API_FORBIDDEN_EVENT, API_UNAUTHORIZED_EVENT, isApiModeEnabled, workItemsService } from "../services/workItemsService";
import { PURCHASE_REQUEST_STATUSES, TASK_PROJECT_STATUSES, type SearchResult } from "../types/workItem";
import type { OwnerIdentity } from "../utils/ownerMatching";

interface DashboardProps {
  onReset: () => void;
  resetting: boolean;
  resetSignal: number;
}

type DashboardOwnerFilter = "me" | "all" | string;

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
  const [searching, setSearching] = useState(false);
  const [dashboardOwnerFilter, setDashboardOwnerFilter] = useState<DashboardOwnerFilter>("me");
  const [directoryOwners, setDirectoryOwners] = useState<OwnerDirectoryEntry[]>([]);
  const [ownerDirectoryLoading, setOwnerDirectoryLoading] = useState(false);
  const [ownerDirectoryError, setOwnerDirectoryError] = useState<string | null>(null);

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

  const loadDirectory = async () => {
    setOwnerDirectoryLoading(true);
    try {
      const response = await loadOwnerDirectory();
      setDirectoryOwners(response.owners);
      setOwnerDirectoryError(null);
    } catch (error) {
      console.error(error);
      setDirectoryOwners([]);
      setOwnerDirectoryError("Owner directory is unavailable; owner filter will be limited.");
    } finally {
      setOwnerDirectoryLoading(false);
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
        ownerGoogleId: searchOwner === "all" ? undefined : searchOwner,
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
    void loadDirectory();

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

  const searchingViewEnabled = activeQuery.length > 0;

  const statusOptions = useMemo(() => {
    const allStatuses = [...PURCHASE_REQUEST_STATUSES, ...TASK_PROJECT_STATUSES];
    return ["all", ...new Set(allStatuses)];
  }, []);

  const currentOwnerDirectoryEntry = useMemo(() => {
    if (!authUser?.googleId) {
      return null;
    }

    return directoryOwners.find((owner) => owner.googleId === authUser.googleId) ?? null;
  }, [authUser?.googleId, directoryOwners]);

  const ownerFilterOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: "Me", value: "me" },
      { label: "All", value: "all" },
    ];

    for (const owner of directoryOwners) {
      const isCurrentUser = currentOwnerDirectoryEntry?.googleId === owner.googleId;
      options.push({
        value: owner.googleId,
        label: isCurrentUser ? `${owner.displayName} (You)` : owner.displayName,
      });
    }

    return options;
  }, [currentOwnerDirectoryEntry?.googleId, directoryOwners]);

  const selectedOwnerIdentity = useMemo<OwnerIdentity | null>(() => {
    if (dashboardOwnerFilter === "all") {
      return null;
    }

    if (dashboardOwnerFilter === "me") {
      if (currentOwnerDirectoryEntry) {
        return {
          googleId: currentOwnerDirectoryEntry.googleId,
          email: currentOwnerDirectoryEntry.email,
          displayName: currentOwnerDirectoryEntry.displayName,
          name: authUser?.name,
        };
      }

      if (authUser) {
        return {
          googleId: authUser.googleId,
          email: authUser.email,
          displayName: authUser.displayName,
          name: authUser.name,
        };
      }

      return null;
    }

    const selectedOwner = directoryOwners.find((owner) => owner.googleId === dashboardOwnerFilter);
    if (!selectedOwner) {
      return null;
    }

    return {
      googleId: selectedOwner.googleId,
      email: selectedOwner.email,
      displayName: selectedOwner.displayName,
    };
  }, [authUser, currentOwnerDirectoryEntry, dashboardOwnerFilter, directoryOwners]);

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
              {directoryOwners.map((owner) => (
                <option key={owner.googleId} value={owner.googleId}>{owner.displayName}</option>
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
        <>
          <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Dashboard Owner</span>
                <select
                  value={dashboardOwnerFilter}
                  onChange={(event) => setDashboardOwnerFilter(event.target.value)}
                  className="min-w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={ownerDirectoryLoading}
                >
                  {ownerFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {ownerDirectoryLoading ? <p className="text-sm text-slate-500">Loading owners…</p> : null}
              {ownerDirectoryError ? <p className="text-sm text-amber-700">{ownerDirectoryError}</p> : null}
            </div>
          </section>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PurchaseRequestsWidget
              resetSignal={resetSignal}
              canManage={canManage}
              includeDeleted={showDeleted}
              canRestore={canUseDeletedFeatures}
              selectedOwnerIdentity={selectedOwnerIdentity}
            />
            <TasksWidget
              resetSignal={resetSignal}
              canManage={canManage}
              includeDeleted={showDeleted}
              canRestore={canUseDeletedFeatures}
              selectedOwnerIdentity={selectedOwnerIdentity}
            />
          </div>
        </>
      ) : null}
    </AppShell>
  );
};

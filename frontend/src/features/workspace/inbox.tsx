"use client";

import * as React from "react";
import {
  ArrowUpDown,
  ChevronRight,
  Copy,
  FileSearch,
  FolderInput,
  Inbox as InboxIcon,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, EvidenceList, PageHeader } from "@/components/moss/primitives";
import { FileTypeGlyph } from "@/components/moss/file-icon";
import { ActionStatusBadge, AnalysisStatusBadge, CertaintyBadge, ConfidenceMeter } from "@/components/moss/badges";
import { useWorkspace } from "@/store/workspace";
import { mossApi } from "@/lib/api/client";
import { Link, useRouter } from "@/lib/router";
import { useDebouncedValue, usePageTitle } from "@/hooks/moss";
import { fileKindLabel, formatBytes, formatDate, formatDueDate, formatRelative } from "@/lib/format";
import type { DocumentRelationship } from "@/types/domain";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type SortKey = "modified-desc" | "modified-asc" | "name-asc" | "size-desc";

function FileDetailDrawer() {
  const selectedFileId = useWorkspace((s) => s.selectedFileId);
  const selectFile = useWorkspace((s) => s.selectFile);
  const files = useWorkspace((s) => s.files);
  const actionItems = useWorkspace((s) => s.actionItems);
  const recommendations = useWorkspace((s) => s.recommendations);
  const collections = useWorkspace((s) => s.collections);
  const startScan = useWorkspace((s) => s.startScan);
  const analysisRunning = useWorkspace((s) => s.analysisRun?.state === "running");
  const router = useRouter();

  const [relationships, setRelationships] = React.useState<DocumentRelationship[] | null>(null);
  const [relationshipsError, setRelationshipsError] = React.useState<string | null>(null);
  const file = files.find((f) => f.id === selectedFileId) ?? null;

  React.useEffect(() => {
    setRelationships(null);
    setRelationshipsError(null);
    if (!selectedFileId) return;
    let cancelled = false;
    void mossApi
      .getFileRelationships(selectedFileId)
      .then((rels) => {
        if (!cancelled) setRelationships(rels);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRelationships([]);
          setRelationshipsError(
            error instanceof Error ? error.message : "Could not load document relationships.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFileId]);

  const close = () => {
    selectFile(null);
    if (router.path.includes("?file=")) router.navigate("/app/inbox", { replace: true });
  };

  const nameById = React.useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  return (
    <Sheet open={Boolean(selectedFileId)} onOpenChange={(open) => (!open ? close() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto slim-scroll p-0 sm:max-w-xl">
        {file ? (
          <>
            <SheetHeader className="space-y-3 border-b border-moss-line px-5 py-4 text-left">
              <div className="flex items-start gap-3">
                <FileTypeGlyph kind={file.kind} />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="break-all text-base font-semibold leading-snug">{file.name}</SheetTitle>
                  <SheetDescription className="mt-0.5 font-mono text-xs">{file.path}</SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AnalysisStatusBadge status={file.status} />
                {file.category ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    <Tag className="size-3" aria-hidden />
                    {file.category}
                  </span>
                ) : null}
                {file.ocrUsed ? (
                  <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">OCR processed</span>
                ) : null}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{formatBytes(file.sizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Modified</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{formatDate(file.modifiedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{fileKindLabel(file.kind)}</dd>
                </div>
              </dl>
            </SheetHeader>

            <div className="flex-1 px-5 py-4">
              {file.status === "error" ? (
                <div role="alert" className="mb-4 rounded-lg border border-moss-error-bg bg-moss-error-bg/60 p-3.5">
                  <p className="text-sm font-medium text-moss-error-fg">Analysis failed for this file</p>
                  <p className="mt-1 text-sm leading-relaxed text-moss-error-fg/90">{file.errorMessage}</p>
                  <p className="mt-2 text-xs text-moss-error-fg/80">
                    Nothing was changed. Enable OCR for scanned documents in Settings, then rescan.
                  </p>
                </div>
              ) : null}

              {file.status === "pending" ? (
                <div className="mb-4 rounded-lg border border-moss-warn-bg bg-moss-warn-bg/50 p-3.5">
                  <p className="text-sm font-medium text-moss-warn-fg">Waiting for analysis</p>
                  <p className="mt-1 text-sm leading-relaxed text-moss-warn-fg/90">
                    This file was discovered but not analyzed yet.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 rounded-lg"
                    disabled={analysisRunning}
                    onClick={async () => {
                      try {
                        await startScan(false);
                      } catch (error) {
                        toast({
                          title: "Analysis could not start",
                          description: error instanceof Error ? error.message : undefined,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {analysisRunning ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : null}
                    {analysisRunning ? "Analysis already running" : "Run analysis"}
                  </Button>
                </div>
              ) : null}

              <Tabs defaultValue="summary">
                <TabsList className="w-full justify-start gap-1 bg-moss-mint/50 p-1">
                  <TabsTrigger value="summary" className="rounded-md text-xs">Summary</TabsTrigger>
                  <TabsTrigger value="related" className="rounded-md text-xs">Related</TabsTrigger>
                  <TabsTrigger value="tasks" className="rounded-md text-xs">Tasks</TabsTrigger>
                  <TabsTrigger value="organization" className="rounded-md text-xs">Organization</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-4 space-y-4">
                  {file.summary ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI summary</h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">{file.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Interpretation by the configured model — verify important details against the source.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No summary yet — analysis has not completed for this file.</p>
                  )}
                  {file.topics.length ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Topics</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {file.topics.map((topic) => (
                          <span key={topic} className="rounded-full bg-moss-mint px-2.5 py-0.5 text-xs font-medium text-moss-forest">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {file.keywords.length ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keywords</h3>
                      <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{file.keywords.join(" · ")}</p>
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="related" className="mt-4">
                  {relationships === null ? (
                    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading relationships…
                    </p>
                  ) : relationshipsError ? (
                    <p role="alert" className="py-6 text-sm text-moss-error-fg">{relationshipsError}</p>
                  ) : relationships.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">No related documents were found for this file yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {relationships.map((rel) => {
                        const otherId = rel.sourceFileId === file.id ? rel.targetFileId : rel.sourceFileId;
                        const other = nameById.get(otherId);
                        return (
                          <li key={rel.id} className="rounded-lg border p-3">
                            <div className="flex items-center gap-2">
                              {other ? <FileTypeGlyph kind={other.kind} size="sm" /> : <Link2 className="size-4 text-moss-sage" aria-hidden />}
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                {other?.name ?? otherId}
                              </span>
                              <span className="shrink-0 rounded bg-moss-info-bg px-1.5 py-0.5 font-mono text-[0.68rem] text-moss-info-fg">
                                {rel.similarity.toFixed(2)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rel.rationale}</p>
                            <button
                              type="button"
                              className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              onClick={() => selectFile(otherId)}
                            >
                              Open {other?.name ?? "related file"}
                              <ChevronRight className="size-3" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                  {(() => {
                    const tasks = actionItems.filter((a) => a.sourceFileId === file.id && a.status !== "dismissed");
                    if (tasks.length === 0) {
                      return <p className="py-6 text-sm text-muted-foreground">No action items were extracted from this document.</p>;
                    }
                    return (
                      <ul className="space-y-3">
                        {tasks.map((task) => (
                          <li key={task.id} className="rounded-lg border p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">{task.title}</p>
                              <ActionStatusBadge status={task.status} />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <CertaintyBadge certainty={task.dateCertainty} />
                              <span className="text-xs text-muted-foreground">
                                {formatDueDate(task.dueDate, task.dateCertainty)}
                              </span>
                              <ConfidenceMeter value={task.confidence} className="ml-auto" />
                            </div>
                            <EvidenceList evidence={[task.evidence]} className="mt-3" />
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="organization" className="mt-4 space-y-4">
                  {file.suggestedName || file.suggestedFolder ? (
                    <ul className="space-y-3">
                      {file.suggestedName ? (
                        <li className="rounded-lg border p-3.5">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Copy className="size-3.5" aria-hidden />
                            Suggested filename
                          </p>
                          <p className="mt-2 break-all font-mono text-sm text-foreground">{file.suggestedName}</p>
                        </li>
                      ) : null}
                      {file.suggestedFolder ? (
                        <li className="rounded-lg border p-3.5">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <FolderInput className="size-3.5" aria-hidden />
                            Suggested destination
                          </p>
                          <p className="mt-2 break-all font-mono text-sm text-foreground">{file.suggestedFolder}</p>
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No organization suggestions for this file right now.</p>
                  )}

                  {(() => {
                    const relevant = recommendations.filter(
                      (r) =>
                        (r.status === "pending" || r.status === "failed" || r.status === "applied") &&
                        (r.current.includes(file.name) || r.evidence.some((e) => e.fileId === file.id)),
                    );
                    if (relevant.length === 0) return null;
                    return (
                      <div className="rounded-lg border bg-moss-mint/30 p-3.5">
                        <p className="text-sm font-medium text-foreground">
                          {relevant.length} related proposal{relevant.length === 1 ? "" : "s"} in the review queue
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Proposals are applied only after your approval. Open the queue to review the details and evidence.
                        </p>
                        <Button asChild size="sm" variant="outline" className="mt-3 rounded-lg">
                          <Link to="/app/recommendations">
                            Open review queue
                            <ChevronRight className="ml-0.5 size-3.5" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    );
                  })()}

                  {collections.filter((c) => c.fileIds.includes(file.id)).length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Member of</h3>
                      <ul className="mt-2 space-y-1.5">
                        {collections
                          .filter((c) => c.fileIds.includes(file.id))
                          .map((collection) => (
                            <li key={collection.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                              <span className="truncate text-sm text-foreground">{collection.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {collection.origin === "confirmed" ? "Confirmed by you" : "AI-suggested"}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">This file is no longer available. It may have been moved or removed.</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={close}>
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function InboxPage() {
  usePageTitle("Inbox");
  const router = useRouter();
  const files = useWorkspace((s) => s.files);
  const settings = useWorkspace((s) => s.settings);
  const selectFile = useWorkspace((s) => s.selectFile);
  const refreshAll = useWorkspace((s) => s.refreshAll);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [kindFilter, setKindFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortKey>("modified-desc");
  const [refreshing, setRefreshing] = React.useState(false);

  // Deep link: /app/inbox?file=f-01
  const queryFileId = React.useMemo(() => {
    const queryString = router.path.split("?")[1] ?? "";
    return new URLSearchParams(queryString).get("file");
  }, [router.path]);

  React.useEffect(() => {
    if (queryFileId) selectFile(queryFileId);
  }, [queryFileId, selectFile]);

  const categories = React.useMemo(
    () => Array.from(new Set(files.map((f) => f.category).filter((c): c is string => Boolean(c)))).sort(),
    [files],
  );

  const visible = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let list = files.filter((file) => {
      if (query && !`${file.name} ${file.path} ${file.keywords.join(" ")}`.toLowerCase().includes(query)) return false;
      if (kindFilter !== "all" && file.kind !== kindFilter) return false;
      if (statusFilter !== "all" && file.status !== statusFilter) return false;
      if (categoryFilter !== "all" && file.category !== categoryFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "size-desc":
          return b.sizeBytes - a.sizeBytes;
        case "modified-asc":
          return a.modifiedAt.localeCompare(b.modifiedAt);
        default:
          return b.modifiedAt.localeCompare(a.modifiedAt);
      }
    });
    return list;
  }, [files, debouncedSearch, kindFilter, statusFilter, categoryFilter, sort]);

  const hasFilters = search !== "" || kindFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all";

  if (!settings?.workspacePath) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inbox" description="Every supported file in your authorized workspace, with its analysis status." />
        <EmptyState
          icon={InboxIcon}
          title="No workspace configured yet"
          description="Moss lists the documents of the folder you authorize during setup. Run the setup guide to choose your workspace."
          action={
            <Button asChild className="rounded-lg">
              <Link to="/app/onboarding">Open the setup guide</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Every supported file in your authorized workspace, with its analysis status and semantic details."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await refreshAll();
              setRefreshing(false);
            }}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Label htmlFor="inbox-search" className="sr-only">
            Search files by name, path, or keyword
          </Label>
          <Input
            id="inbox-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, path, or keyword…"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger aria-label="Filter by type" className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Array.from(new Set(files.map((f) => f.kind))).map((kind) => (
                <SelectItem key={kind} value={kind}>{fileKindLabel(kind)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by status" className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="analyzed">Analyzed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Filter by category" className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger aria-label="Sort files" className="w-full">
              <span className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="size-3.5" aria-hidden />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modified-desc">Newest first</SelectItem>
              <SelectItem value="modified-asc">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="size-desc">Largest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="No files match these filters"
            description="Try a different search term, or reset the filters to see the whole workspace."
            action={
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setSearch("");
                  setKindFilter("all");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FileSearch}
            title="No files discovered yet"
            description="Run an analysis and discovered documents will appear here with their status and details."
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <caption className="sr-only">Workspace files</caption>
            <thead>
              <tr className="border-b bg-moss-ivory/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">File</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Size</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Modified</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((file) => (
                <tr
                  key={file.id}
                  tabIndex={0}
                  aria-label={`Open details for ${file.name}`}
                  onClick={() => selectFile(file.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectFile(file.id);
                    }
                  }}
                  className="cursor-pointer border-b border-moss-line/60 transition-colors last:border-0 hover:bg-moss-mint/25 focus-visible:bg-moss-mint/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <td className="max-w-0 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileTypeGlyph kind={file.kind} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{file.name}</p>
                        <p className="truncate font-mono text-[0.68rem] text-muted-foreground">{file.path}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{fileKindLabel(file.kind)}</td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{formatBytes(file.sizeBytes)}</td>
                  <td className="px-3 py-3 text-muted-foreground" title={formatRelative(file.modifiedAt)}>
                    {formatDate(file.modifiedAt)}
                  </td>
                  <td className="px-3 py-3"><AnalysisStatusBadge status={file.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{file.category ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="divide-y divide-moss-line/70 md:hidden">
            {visible.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => selectFile(file.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-moss-mint/25 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <FileTypeGlyph kind={file.kind} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatBytes(file.sizeBytes)} · {formatDate(file.modifiedAt)}
                    </span>
                  </span>
                  <AnalysisStatusBadge status={file.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {visible.length} of {files.length} files. Moss never lists anything outside the authorized
        workspace; paths are shown relative to its root.
      </p>

      <FileDetailDrawer />
    </div>
  );
}

"use client";

import * as React from "react";
import { CalendarClock, Check, ChevronDown, CircleSlash, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState, PageHeader } from "@/components/moss/primitives";
import { FileTypeGlyph } from "@/components/moss/file-icon";
import { ActionStatusBadge, CertaintyBadge, ConfidenceMeter } from "@/components/moss/badges";
import { useWorkspace } from "@/store/workspace";
import { useRouter } from "@/lib/router";
import { useDebouncedValue, usePageTitle } from "@/hooks/moss";
import { formatDueDate, formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ActionItemStatus } from "@/types/domain";

type SortKey = "deadline" | "confidence" | "discovered";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "new", label: "New" },
  { value: "verified", label: "Verified" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismissed" },
];

export function ActionItemsPage() {
  usePageTitle("Action Items");
  const router = useRouter();
  const actionItems = useWorkspace((s) => s.actionItems);
  const files = useWorkspace((s) => s.files);
  const setActionItemStatus = useWorkspace((s) => s.setActionItemStatus);
  const busyIds = useWorkspace((s) => s.busyIds);

  const [statusFilter, setStatusFilter] = React.useState("open");
  const [sort, setSort] = React.useState<SortKey>("deadline");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const fileById = React.useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  const visible = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let list = actionItems.filter((item) => {
      if (statusFilter === "open" && (item.status === "dismissed" || item.status === "done")) return false;
      if (statusFilter !== "open" && item.status !== statusFilter) return false;
      if (query) {
        const source = fileById.get(item.sourceFileId)?.name ?? "";
        if (!`${item.title} ${source}`.toLowerCase().includes(query)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "confidence") return b.confidence - a.confidence;
      if (sort === "discovered") return b.discoveredAt.localeCompare(a.discoveredAt);
      // Deadlines: explicit dates first (soonest first), then inferred, then uncertain.
      const rank = (item: (typeof list)[number]) =>
        item.dateCertainty === "explicit" ? 0 : item.dateCertainty === "inferred" ? 1 : 2;
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    });
    return list;
  }, [actionItems, statusFilter, sort, debouncedSearch, fileById]);

  const update = async (id: string, status: ActionItemStatus, description: string) => {
    try {
      await setActionItemStatus(id, status);
      toast({ title: description });
    } catch (error) {
      toast({
        title: "Could not update the action item",
        description: error instanceof Error ? error.message : "The backend could not update the action item.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Action Items"
        description="Tasks, deadlines, and follow-ups Moss discovered inside your documents — each with its source and evidence. Estimated dates are always labelled."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                statusFilter === tab.value ? "bg-moss-forest text-moss-ivory" : "text-muted-foreground hover:bg-moss-mint/50 hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.value === "open" ? (
                <span className="ml-1.5 text-xs opacity-75">
                  {actionItems.filter((a) => a.status === "new" || a.status === "verified").length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 lg:justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="task-search" className="sr-only">Search action items</Label>
            <Input
              id="task-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks or sources…"
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger aria-label="Sort action items" className="w-40 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">By deadline</SelectItem>
              <SelectItem value="confidence">By confidence</SelectItem>
              <SelectItem value="discovered">Newest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={statusFilter === "open" ? "No open action items" : "Nothing here"}
          description={
            statusFilter === "open"
              ? "When Moss finds tasks or deadlines inside your documents, they appear here with a link back to the source passage."
              : "No action items match this filter right now."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            const source = fileById.get(item.sourceFileId);
            const busy = busyIds.includes(item.id);
            return (
              <li key={item.id} className={cn("rounded-xl border bg-card p-4 transition-opacity", busy && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                      <ActionStatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      from{" "}
                      <button
                        type="button"
                        className="rounded-sm font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() => source && router.navigate(`/app/inbox?file=${source.id}`)}
                      >
                        {source?.name ?? item.sourceFileId}
                      </button>
                      {" · "}
                      discovered {formatRelative(item.discoveredAt)}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <CertaintyBadge certainty={item.dateCertainty} />
                      <span className={cn("inline-flex items-center gap-1.5 text-xs", item.dateCertainty === "uncertain" ? "text-muted-foreground" : "text-foreground")}>
                        <CalendarClock className="size-3.5 text-moss-sage" aria-hidden />
                        {formatDueDate(item.dueDate, item.dateCertainty)}
                      </span>
                      <ConfidenceMeter value={item.confidence} className="ml-0 sm:ml-2" />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {item.status === "new" ? (
                      <>
                        <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => void update(item.id, "dismissed", "Action item dismissed")}>
                          <X className="mr-1 size-3.5" aria-hidden />
                          Dismiss
                        </Button>
                        <Button size="sm" className="rounded-lg" disabled={busy} onClick={() => void update(item.id, "verified", "Task verified — it stays on your list")}>
                          <Check className="mr-1 size-3.5" aria-hidden />
                          Verify
                        </Button>
                      </>
                    ) : null}
                    {item.status === "verified" ? (
                      <>
                        <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => void update(item.id, "new", "Moved back to new")}>
                          Reopen
                        </Button>
                        <Button size="sm" className="rounded-lg" disabled={busy} onClick={() => void update(item.id, "done", "Marked as done — nicely handled")}>
                          <Check className="mr-1 size-3.5" aria-hidden />
                          Mark done
                        </Button>
                      </>
                    ) : null}
                    {item.status === "done" || item.status === "dismissed" ? (
                      <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={busy} onClick={() => void update(item.id, "new", "Action item reopened")}>
                        <CircleSlash className="mr-1 size-3.5" aria-hidden />
                        Reopen
                      </Button>
                    ) : null}
                  </div>
                </div>

                <Collapsible className="mt-3">
                  <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    Show evidence from the source document
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2.5">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-foreground">
                        <span className="truncate">{item.evidence.fileName}</span>
                        {item.evidence.page ? <span className="text-muted-foreground">· page {item.evidence.page}</span> : null}
                        {item.evidence.location ? (
                          <span className="font-mono text-[0.68rem] text-muted-foreground">{item.evidence.location}</span>
                        ) : null}
                      </div>
                      <blockquote className="mt-1.5 border-l-2 border-moss-sage/70 pl-2.5 text-[0.8rem] leading-relaxed text-muted-foreground">
                        “{item.evidence.excerpt}”
                      </blockquote>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Dates shown as “estimated” were inferred by the model — verify them before relying on them. Items
        extracted with low confidence can be dismissed; dismissals are remembered for this document version.
      </p>
    </div>
  );
}

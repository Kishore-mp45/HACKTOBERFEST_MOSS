"use client";

import * as React from "react";
import { Copy, Equal, EyeOff, RotateCcw, SplitSquareVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/moss/primitives";
import { useWorkspace } from "@/store/workspace";
import { usePageTitle } from "@/hooks/moss";
import { formatBytes, formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DuplicateGroup } from "@/types/domain";

const KIND_META: Record<DuplicateGroup["kind"], { label: string; badge: string; blurb: string }> = {
  exact: {
    label: "Exact",
    badge: "bg-moss-error-bg text-moss-error-fg",
    blurb: "Byte-identical files detected by checksum.",
  },
  near: {
    label: "Near-duplicate",
    badge: "bg-moss-warn-bg text-moss-warn-fg",
    blurb: "Almost certainly revisions of the same document — different enough that you should choose.",
  },
  semantic: {
    label: "Semantically related",
    badge: "bg-moss-info-bg text-moss-info-fg",
    blurb: "Not duplicates — documents about the same topic that may belong together.",
  },
};

function GroupCard({ group }: { group: DuplicateGroup }) {
  const files = useWorkspace((s) => s.files);
  const duplicates = useWorkspace((s) => s.duplicates);
  const setDuplicateStatus = useWorkspace((s) => s.setDuplicateStatus);
  const busy = useWorkspace((s) => s.busyIds.includes(group.id));

  const groupFiles = group.fileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));
  const meta = KIND_META[group.kind];
  const isDimmed = duplicates.find((d) => d.id === group.id)?.status === "dismissed";

  const updateStatus = async (status: DuplicateGroup["status"], message: string) => {
    try {
      await setDuplicateStatus(group.id, status);
      toast({ title: message, description: "No files were modified." });
    } catch (error) {
      toast({
        title: "Could not update this candidate",
        description: error instanceof Error ? error.message : "The backend could not update this candidate.",
        variant: "destructive",
      });
    }
  };

  return (
    <article className={cn("rounded-xl border bg-card transition-opacity", isDimmed && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-moss-line/70 px-5 py-3">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", meta.badge)}>
          {meta.label}
        </span>
        <span className="rounded-full border px-2 py-0.5 font-mono text-[0.68rem] text-muted-foreground">{group.method}</span>
        {isDimmed ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <EyeOff className="size-3.5" aria-hidden />
            Dismissed {group.discoveredAt ? formatRelative(group.discoveredAt) : ""}
          </span>
        ) : group.discoveredAt ? (
          <span className="ml-auto text-xs text-muted-foreground">
            discovered {formatRelative(group.discoveredAt)}
          </span>
        ) : null}
      </div>

      <div className="p-5">
        <p className="text-sm leading-relaxed text-foreground">{group.reason}</p>

        <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
          {groupFiles.map((file, index) => (
            <section key={file.id} aria-label={`Duplicate candidate ${index + 1}`} className="rounded-lg border bg-moss-ivory/40 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Candidate {index + 1}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{file.path}</p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {formatBytes(file.sizeBytes)} · {file.modifiedAt ? formatRelative(file.modifiedAt) : "modified date unavailable"}
              </p>
              {file.summary ? (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{file.summary}</p>
              ) : null}
            </section>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {group.status === "open" ? (
            <>
              <span className="mr-auto text-xs text-muted-foreground">
                Moss never deletes or merges automatically — deciding is your call.
              </span>
              <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => void updateStatus("dismissed", "Candidate dismissed — both files stay untouched")}>
                <EyeOff className="mr-1.5 size-3.5" aria-hidden />
                Dismiss candidate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg text-muted-foreground"
                disabled={busy}
                onClick={() => void updateStatus("dismissed", "Noted — both files stay. The candidate was dismissed.")}
              >
                <Copy className="mr-1.5 size-3.5" aria-hidden />
                Keep both
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="rounded-lg" disabled={busy} onClick={() => void updateStatus("open", "Candidate re-opened for review")}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Re-open for review
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function DuplicatesPage() {
  usePageTitle("Duplicates");
  const duplicates = useWorkspace((s) => s.duplicates);
  const [showDismissed, setShowDismissed] = React.useState(false);

  const open = duplicates.filter((d) => d.status === "open");
  const byKind = (kind: DuplicateGroup["kind"], includeDismissed: boolean) =>
    duplicates.filter((d) => d.kind === kind && (includeDismissed || d.status === "open"));

  const renderList = (kind: DuplicateGroup["kind"], includeDismissed: boolean) => {
    const list = byKind(kind, includeDismissed);
    if (list.length === 0) {
      return (
        <EmptyState
          icon={kind === "exact" ? Equal : kind === "near" ? Copy : SplitSquareVertical}
          title={`No ${KIND_META[kind].label.toLowerCase()} candidates ${includeDismissed ? "found" : "open"}`}
          description={
            includeDismissed
              ? "Nothing matched this category in the current analysis."
              : KIND_META[kind].blurb + " Dismissed candidates are hidden — toggle “Show dismissed” to see them."
          }
        />
      );
    }
    return (
      <ul className="space-y-4">
        {list.map((group) => (
          <li key={group.id}>
            <GroupCard group={group} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Duplicates"
        description="Exact copies, likely near-duplicates, and semantically related documents — separated clearly, because they need different decisions."
        badge={
          open.length ? (
            <span className="rounded-full bg-moss-warn-bg px-2 py-0.5 text-xs font-medium text-moss-warn-fg">
              {open.length} open
            </span>
          ) : (
            <span className="rounded-full bg-moss-ok-bg px-2 py-0.5 text-xs font-medium text-moss-ok-fg">All clear</span>
          )
        }
      />

      <div className="flex items-center gap-2">
        <Switch id="show-dismissed" checked={showDismissed} onCheckedChange={setShowDismissed} />
        <Label htmlFor="show-dismissed" className="text-sm text-muted-foreground">
          Show dismissed candidates
        </Label>
      </div>

      <Tabs defaultValue="exact">
        <TabsList className="w-full justify-start gap-1 bg-moss-mint/50 p-1">
          {(["exact", "near", "semantic"] as const).map((kind) => (
            <TabsTrigger key={kind} value={kind} className="rounded-md text-xs sm:text-sm">
              {KIND_META[kind].label}
              <span className="ml-1.5 opacity-70">{byKind(kind, showDismissed).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {(["exact", "near", "semantic"] as const).map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-4">
            {renderList(kind, showDismissed)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

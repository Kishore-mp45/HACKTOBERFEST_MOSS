"use client";

import * as React from "react";
import {
  Archive,
  ArrowUpCircle,
  CheckCircle2,
  FolderPlus,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  ScanSearch,
  Settings2,
  SplitSquareVertical,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/moss/primitives";
import { useWorkspace } from "@/store/workspace";
import { usePageTitle } from "@/hooks/moss";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityKind } from "@/types/domain";

const KIND_ICON: Record<ActivityKind, React.ElementType> = {
  scan: ScanSearch,
  analysis: Sparkles,
  approval: CheckCircle2,
  rename: Pencil,
  move: FolderPlus,
  archive: Archive,
  collection: FolderPlus,
  error: XCircle,
  recovery: RotateCcw,
  dismissal: Trash2,
};

function OutcomeBadge({ event }: { event: ActivityEvent }) {
  if (event.undone) {
    return (
      <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">Undone</span>
    );
  }
  if (event.outcome === "failure") {
    return <span className="rounded-full bg-moss-error-bg px-2 py-0.5 text-xs font-medium text-moss-error-fg">Failed</span>;
  }
  if (event.outcome === "partial") {
    return <span className="rounded-full bg-moss-warn-bg px-2 py-0.5 text-xs font-medium text-moss-warn-fg">Partial</span>;
  }
  return <span className="rounded-full bg-moss-ok-bg px-2 py-0.5 text-xs font-medium text-moss-ok-fg">Success</span>;
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const undoActivity = useWorkspace((s) => s.undoActivity);
  const undoing = useWorkspace((s) => s.undoingIds.includes(event.operationId ?? ""));
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const Icon = KIND_ICON[event.kind];
  const canUndo = event.undoable && !event.undone && Boolean(event.operationId);

  const undo = async () => {
    setConfirmOpen(false);
    if (!event.operationId) return;
    try {
      await undoActivity(event.operationId);
      toast({ title: "Operation undone", description: "The previous state was restored and the reversal logged." });
    } catch (error) {
      toast({
        title: "Undo failed",
        description: error instanceof Error ? error.message : "The backend could not reverse this operation.",
        variant: "destructive",
      });
    }
  };

  return (
    <li className="relative pl-10">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 flex size-7 items-center justify-center rounded-full border bg-card",
          event.outcome === "failure" && !event.undone ? "border-moss-error-fg/40 text-moss-error-fg" : "border-moss-line text-moss-moss",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("text-sm font-medium text-foreground", event.undone && "line-through decoration-moss-sage")}>
            {event.title}
          </h3>
          <OutcomeBadge event={event} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{event.detail}</p>
        <p className="mt-1.5 text-xs text-muted-foreground" title={formatDateTime(event.createdAt)}>
          {formatRelative(event.createdAt)}
        </p>
        {canUndo ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-2.5 rounded-lg"
            disabled={undoing}
            title="Undo is unavailable if the file was deleted or moved outside Moss. A cross-device move may not be atomic if interrupted. Resetting the workspace clears operation history."
            onClick={() => setConfirmOpen(true)}
          >
            {undoing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <ArrowUpCircle className="mr-1.5 size-3.5" aria-hidden />}
            Undo
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this operation?</AlertDialogTitle>
            <AlertDialogDescription>
              The backend will restore the previous state of “{event.title}” and log the reversal. Files may
              briefly appear in both locations while the reversal propagates. Undo cannot recover a file
              deleted or moved externally, and an interrupted cross-device move may not be atomic. History
              remains available until this workspace is reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Keep as is</AlertDialogCancel>
            <AlertDialogAction className="rounded-lg" onClick={() => void undo()}>
              Undo operation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function ActivityPage() {
  usePageTitle("Activity");
  const activity = useWorkspace((s) => s.activity);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity"
        description="Every scan, approval, and file operation Moss performed — including failures and recoveries. Undo appears only when the backend confirms reliable recovery."
      />

      {activity.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Run an analysis or approve a suggestion — everything that happens to your workspace is recorded here."
        />
      ) : (
        <ol className="rounded-xl border bg-card p-5">
          {activity.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </ol>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-moss-line bg-moss-mint/40 px-4 py-3 text-xs leading-relaxed text-moss-forest">
        <Settings2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Operations marked “Partial” completed with recoverable errors. The backend decides what is reversible —
        the Undo button only appears when reliable recovery is confirmed.
      </p>
    </div>
  );
}

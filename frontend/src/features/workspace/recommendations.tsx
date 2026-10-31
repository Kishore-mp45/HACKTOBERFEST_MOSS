"use client";

import * as React from "react";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  FolderPlus,
  Loader2,
  Pencil,
  ShieldAlert,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState, EvidenceList, PageHeader } from "@/components/moss/primitives";
import { ConfidenceMeter, RecommendationStatusBadge, RiskBadge } from "@/components/moss/badges";
import { useWorkspace } from "@/store/workspace";
import { usePageTitle } from "@/hooks/moss";
import { formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Recommendation, RecommendationKind } from "@/types/domain";

const KIND_META: Record<RecommendationKind, { label: string; icon: React.ElementType }> = {
  rename: { label: "Rename", icon: Pencil },
  move: { label: "Move", icon: FolderPlus },
  archive: { label: "Archive", icon: Archive },
  collection: { label: "Collection", icon: FolderPlus },
  duplicate_review: { label: "Duplicate review", icon: Copy },
};

function validateProposal(rec: Recommendation, proposed: string): string | null {
  const value = proposed.trim();
  if (!value) return "The proposal cannot be empty.";
  if (value === rec.proposed) return "Choose a value different from the current proposal.";
  if (rec.kind === "rename") {
    if (value.includes("/")) return "Filenames cannot contain slashes.";
    if (!/\.[a-z0-9]{2,5}$/i.test(value)) return "Keep the file extension (e.g. .pdf, .docx).";
    if (value === rec.current) return "That is the current filename — nothing would change.";
  }
  if ((rec.kind === "move" || rec.kind === "archive") && !value.endsWith("/")) {
    return "Folder destinations should end with a slash (e.g. Research/Thesis/).";
  }
  return null;
}

function EditDialog({ rec, open, onOpenChange }: { rec: Recommendation; open: boolean; onOpenChange: (open: boolean) => void }) {
  const editRecommendation = useWorkspace((s) => s.editRecommendation);
  const [value, setValue] = React.useState(rec.proposed);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValue(rec.proposed);
      setError(null);
    }
  }, [open, rec.proposed]);

  const save = async () => {
    const validationError = validateProposal(rec, value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await editRecommendation(rec.id, value.trim());
      toast({ title: "Proposal updated", description: "Review the edited proposal before approving it." });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the change.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit proposal</DialogTitle>
          <DialogDescription>
            Adjust what Moss should do. Your edit replaces the proposal — the reasoning and evidence stay attached.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`edit-${rec.id}`}>
            {rec.kind === "rename" ? "New filename" : rec.kind === "collection" ? "Collection name" : "Destination folder"}
          </Label>
          <Input
            id={`edit-${rec.id}`}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            className={cn("font-mono text-sm", error && "border-moss-error-fg")}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `edit-error-${rec.id}` : undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !saving) void save();
            }}
          />
          {error ? (
            <p id={`edit-error-${rec.id}`} role="alert" className="flex items-center gap-1.5 text-xs text-moss-error-fg">
              <TriangleAlert className="size-3.5" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-lg" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="rounded-lg" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
            Save proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const approveRecommendation = useWorkspace((s) => s.approveRecommendation);
  const executeRecommendation = useWorkspace((s) => s.executeRecommendation);
  const rejectRecommendation = useWorkspace((s) => s.rejectRecommendation);
  const executing = useWorkspace((s) => s.executingIds.includes(rec.id));
  const busy = useWorkspace((s) => s.busyIds.includes(rec.id));

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"approve" | "execute">("approve");
  const [editOpen, setEditOpen] = React.useState(false);

  const Icon = KIND_META[rec.kind].icon;

  const approve = async () => {
    setConfirmOpen(false);
    try {
      await approveRecommendation(rec.id);
      toast({
        title: "Recommendation approved",
        description: "No file has changed. You can execute this approved operation separately.",
      });
    } catch (error) {
      toast({
        title: "Could not approve the recommendation",
        description: error instanceof Error ? error.message : "The backend could not record approval.",
        variant: "destructive",
      });
    }
  };

  const execute = async () => {
    setConfirmOpen(false);
    try {
      const result = await executeRecommendation(rec.id);
      toast({
        title: "Operation applied",
        description: result.resultMessage ?? "The change was executed and logged.",
      });
    } catch (error) {
      toast({
        title: "Operation failed",
        description: error instanceof Error ? error.message : "The backend reported a failure.",
        variant: "destructive",
      });
    }
  };

  const reject = async () => {
    try {
      await rejectRecommendation(rec.id);
      toast({ title: "Proposal rejected", description: "Moss will not raise the same suggestion again for this file version." });
    } catch (error) {
      toast({
        title: "Could not reject the proposal",
        description: error instanceof Error ? error.message : "The backend could not reject the proposal.",
        variant: "destructive",
      });
    }
  };

  const pending = rec.status === "pending";
  const approved = rec.status === "approved";

  return (
    <article className={cn("rounded-xl border bg-card", pending && "border-moss-sage/60")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-moss-line/70 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-moss-info-bg px-2 py-0.5 text-xs font-medium text-moss-info-fg">
          <Icon className="size-3.5" aria-hidden />
          {KIND_META[rec.kind].label}
        </span>
        <RiskBadge risk={rec.risk} />
        <ConfidenceMeter value={rec.confidence} className="hidden sm:inline-flex" />
        <span className="ml-auto text-xs text-muted-foreground">{formatRelative(rec.createdAt)}</span>
        <RecommendationStatusBadge status={rec.status} />
      </div>

      <div className="p-5">
        <h2 className="text-sm font-semibold text-foreground">{rec.title}</h2>

        {/* Current vs proposed */}
        <div className="mt-3 rounded-lg border bg-moss-ivory/40 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{rec.current}</p>
            </div>
            <ArrowRight className="hidden size-4 shrink-0 text-moss-moss sm:block" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Proposed</p>
              <p className={cn("mt-1 break-all font-mono text-xs font-medium", pending ? "text-moss-forest" : "text-foreground")}>
                {rec.proposed}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{rec.rationale}</p>

        {rec.conflict ? (
          <div role="alert" className="mt-3 rounded-lg border border-moss-error-bg bg-moss-error-bg/60 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-moss-error-fg">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              Conflict — nothing was changed
            </p>
            <p className="mt-1 text-sm leading-relaxed text-moss-error-fg/90">{rec.conflict}</p>
            {rec.resultMessage ? <p className="mt-1 text-xs text-moss-error-fg/80">{rec.resultMessage}</p> : null}
            <p className="mt-2 text-xs text-moss-error-fg/80">
              Reject this proposal, or ask for a different destination — Moss will re-check the path before moving anything.
            </p>
          </div>
        ) : null}

        {rec.status === "applied" && rec.resultMessage ? (
          <p className="mt-3 rounded-lg bg-moss-ok-bg/60 px-3.5 py-2.5 text-xs leading-relaxed text-moss-ok-fg">
            {rec.resultMessage}
          </p>
        ) : null}

        <Collapsible className="mt-3">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            Evidence and reasoning ({rec.evidence.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <EvidenceList evidence={rec.evidence} />
          </CollapsibleContent>
        </Collapsible>

        {pending ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-moss-line/70 pt-4">
            <span className="mr-auto text-xs text-muted-foreground">
              Approval records your decision; it does not change any files.
            </span>
            <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={busy || executing} onClick={() => void reject()}>
              <X className="mr-1 size-3.5" aria-hidden />
              Reject
            </Button>
            {rec.kind === "rename" || rec.kind === "move" ? (
              <Button size="sm" variant="outline" className="rounded-lg" disabled={busy || executing} onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 size-3.5" aria-hidden />
                Edit
              </Button>
            ) : null}
            <Button size="sm" className="rounded-lg" disabled={busy || executing} onClick={() => {
              setConfirmAction("approve");
              setConfirmOpen(true);
            }}>
              {executing ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1 size-3.5" aria-hidden />}
              Approve
            </Button>
          </div>
        ) : null}
        {approved ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-moss-line/70 pt-4">
            <span className="mr-auto text-xs text-muted-foreground">
              Approved. Review the preview once more before executing.
            </span>
            <Button size="sm" className="rounded-lg" disabled={busy || executing} onClick={() => {
              setConfirmAction("execute");
              setConfirmOpen(true);
            }}>
              {executing ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1 size-3.5" aria-hidden />}
              {executing ? "Applying…" : "Execute"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Confirmation for consequential operations */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "approve"
                ? "Approve this recommendation?"
                : rec.kind === "rename"
                ? "Rename this file?"
                : rec.kind === "archive"
                  ? "Archive this file?"
                  : rec.kind === "collection"
                    ? "Create this collection?"
                    : rec.kind === "duplicate_review"
                      ? "Review this duplicate candidate?"
                      : "Move this file?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2.5">
                <span className="block">
                  {confirmAction === "approve"
                    ? "This records your approval only. No file operation will run until you separately choose Execute."
                    : rec.kind === "collection"
                      ? `The related collection will be confirmed. Files are grouped, not moved.`
                      : rec.kind === "duplicate_review"
                        ? "This review decision will be recorded. No files will be changed."
                        : "The backend will execute exactly the operation below, log it, and keep it reversible where supported."}
                </span>
                <span className="block break-all rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                  {rec.current} → {rec.proposed}
                </span>
                {confirmAction === "execute" && rec.risk !== "low" ? (
                  <span className="flex items-start gap-1.5 rounded-lg bg-moss-warn-bg/70 px-3 py-2 text-xs text-moss-warn-fg">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    This proposal is marked {rec.risk} risk. You can edit it first if something looks off.
                  </span>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-lg" onClick={() => void (confirmAction === "approve" ? approve() : execute())}>
              {confirmAction === "approve" ? "Approve only" : "Execute approved operation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pending ? <EditDialog rec={rec} open={editOpen} onOpenChange={setEditOpen} /> : null}
    </article>
  );
}

export function RecommendationsPage() {
  usePageTitle("Review Queue");
  const recommendations = useWorkspace((s) => s.recommendations);
  const approveRecommendations = useWorkspace((s) => s.approveRecommendations);
  const [bulkApproving, setBulkApproving] = React.useState(false);
  const [kindFilter, setKindFilter] = React.useState<RecommendationKind | "all">("all");
  const [sortOrder, setSortOrder] = React.useState<"priority" | "newest" | "oldest">("priority");
  const [tab, setTab] = React.useState<"pending" | "history">("pending");

  const pending = recommendations.filter((r) => r.status === "pending");
  const approved = recommendations.filter((r) => r.status === "approved");
  const history = recommendations.filter((r) => ["applied", "rejected", "dismissed", "failed"].includes(r.status));

  const queue = [...pending, ...approved];
  const visibleQueue = queue
    .filter((recommendation) => kindFilter === "all" || recommendation.kind === kindFilter)
    .sort((first, second) => {
      if (sortOrder === "newest") return second.createdAt.localeCompare(first.createdAt);
      if (sortOrder === "oldest") return first.createdAt.localeCompare(second.createdAt);
      return second.confidence - first.confidence;
    });

  const approveAll = async () => {
    setBulkApproving(true);
    try {
      await approveRecommendations(pending.map((rec) => rec.id));
      toast({ title: "Recommendations approved", description: "No files were changed. Execute approved operations individually." });
    } catch (error) {
      toast({
        title: "Could not approve recommendations",
        description: error instanceof Error ? error.message : "The backend could not record these approvals.",
        variant: "destructive",
      });
    } finally {
      setBulkApproving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review Queue"
        description="Proposed renames, moves, and review decisions. Approval is recorded first; file changes happen only after you separately choose Execute."
        badge={
          queue.length ? (
            <span className="rounded-full bg-moss-warn-bg px-2 py-0.5 text-xs font-medium text-moss-warn-fg">
              {queue.length} in the review queue
            </span>
          ) : (
            <span className="rounded-full bg-moss-ok-bg px-2 py-0.5 text-xs font-medium text-moss-ok-fg">Queue clear</span>
          )
        }
      />

      <div className="flex w-fit flex-wrap gap-1 rounded-lg border bg-card p-1" role="tablist" aria-label="Queue or history">
        {(
          [
            { id: "pending", label: `Review queue (${queue.length})` },
            { id: "history", label: `Decided (${history.length})` },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              tab === entry.id ? "bg-moss-forest text-moss-ivory" : "text-muted-foreground hover:bg-moss-mint/50 hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        visibleQueue.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={queue.length === 0 ? "The review queue is clear" : "No recommendations match this filter"}
            description={queue.length === 0
              ? "New proposals appear here after each analysis. Approve, edit, or reject them — rejected suggestions are not raised again for the same document version."
              : "Choose another recommendation type to see the remaining items."}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as RecommendationKind | "all")}>
                <SelectTrigger aria-label="Filter recommendations by type" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All recommendation types</SelectItem>
                  {(Object.keys(KIND_META) as RecommendationKind[]).map((kind) => (
                    <SelectItem key={kind} value={kind}>{KIND_META[kind].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
                <SelectTrigger aria-label="Sort recommendations" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Highest confidence</SelectItem>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pending.length > 1 ? (
              <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-moss-mint/30 p-4">
                <div className="mr-auto">
                  <h2 className="text-sm font-semibold">Approval summary</h2>
                  <p className="text-xs text-muted-foreground">
                    {pending.length} pending recommendations · approval will not change files.
                  </p>
                </div>
                <Button className="rounded-lg" disabled={bulkApproving} onClick={() => void approveAll()}>
                  {bulkApproving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
                  Approve all pending
                </Button>
              </section>
            ) : null}
            <ul className="space-y-4">
              {visibleQueue.map((rec) => (
                <li key={rec.id}>
                  <RecommendationCard rec={rec} />
                </li>
              ))}
            </ul>
          </>
        )
      ) : history.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No decisions yet"
          description="Applied, rejected, and dismissed proposals are listed here with their outcome."
        />
      ) : (
        <ul className="space-y-4">
          {history.map((rec) => (
            <li key={rec.id}>
              <RecommendationCard rec={rec} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

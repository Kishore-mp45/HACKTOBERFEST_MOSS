"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileWarning,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  SplitSquareVertical,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatCard } from "@/components/moss/primitives";
import { FileTypeGlyph } from "@/components/moss/file-icon";
import { useWorkspace } from "@/store/workspace";
import { Link, useRouter } from "@/lib/router";
import { usePageTitle } from "@/hooks/moss";
import { formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AnalysisStage } from "@/types/domain";

/** Live view of the analysis pipeline — real stage data from the API, never fabricated. */
function StageRow({ stage }: { stage: AnalysisStage }) {
  const running = stage.state === "running";
  const done = stage.state === "done";
  const failed = stage.state === "error";
  const pct = stage.total ? Math.round((stage.processed / stage.total) * 100) : 0;
  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        {running ? <Loader2 className="size-4 shrink-0 animate-spin text-moss-moss" aria-hidden /> : null}
        {done ? <CheckCircle2 className="size-4 shrink-0 text-moss-ok-fg" aria-hidden /> : null}
        {failed ? <FileWarning className="size-4 shrink-0 text-moss-error-fg" aria-hidden /> : null}
        {stage.state === "pending" ? <CircleDot className="size-4 shrink-0 text-moss-line" aria-hidden /> : null}
        <span className={cn("font-medium", done ? "text-foreground" : running ? "text-foreground" : "text-muted-foreground")}>
          {stage.label}
        </span>
        <span className="ml-auto tabular-nums text-xs text-muted-foreground">
          {stage.processed}/{stage.total}
          {failed && stage.message ? ` · ${stage.message}` : ""}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" aria-label={`${stage.label}: ${pct}%`} />
    </li>
  );
}

export function AnalysisDialog() {
  const run = useWorkspace((s) => s.analysisRun);
  const open = useWorkspace((s) => s.scanDialogOpen);
  const setOpen = useWorkspace((s) => s.setScanDialogOpen);
  const clearAnalysis = useWorkspace((s) => s.clearAnalysis);
  const starting = useWorkspace((s) => s.scanStarting);

  const isRunning = run?.state === "running" || starting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRunning ? <Loader2 className="size-4 animate-spin text-moss-moss" aria-hidden /> : <Sparkles className="size-4 text-moss-forest" aria-hidden />}
            {isRunning ? "Analyzing your workspace" : run?.state === "completed" ? "Analysis completed" : "Analysis finished"}
          </DialogTitle>
          <DialogDescription>
            {isRunning
              ? "Moss is reading your authorized workspace. You can close this panel — the analysis keeps running and results appear automatically."
              : run?.state === "completed"
                ? "New relationships, tasks, and suggestions were discovered. They are waiting for your review — nothing was changed in your files."
                : "The analysis finished, but some files could not be processed."}
          </DialogDescription>
        </DialogHeader>

        {run ? (
          <div className="space-y-4">
            <ul className="space-y-3" aria-label="Analysis stages">
              {run.stages.map((stage) => (
                <StageRow key={stage.id} stage={stage} />
              ))}
            </ul>

            {run.errors.length > 0 ? (
              <div className="rounded-lg border border-moss-error-bg bg-moss-error-bg/50 p-3" role="alert">
                <p className="flex items-center gap-1.5 text-sm font-medium text-moss-error-fg">
                  <AlertTriangle className="size-4" aria-hidden />
                  {run.errors.length} file could not be processed
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-moss-error-fg/90">
                  {run.errors.map((error) => (
                    <li key={error.fileId} className="truncate">
                      <span className="font-mono">{error.fileName}</span> — {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {isRunning
                  ? "Polling progress from the backend every 450 ms."
                  : `Finished ${formatRelative(run.finishedAt)}`}
              </p>
              <div className="flex gap-2">
                {isRunning ? (
                  <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setOpen(false)}>
                    Hide panel
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        setOpen(false);
                        toast({ title: "Analysis panel cleared" });
                      }}
                    >
                      <RotateCcw className="mr-1 size-3.5" aria-hidden />
                      Dismiss
                    </Button>
                    <Button asChild size="sm" className="rounded-lg">
                      <Link to="/app/recommendations">
                        Review results
                        <ChevronRight className="ml-0.5 size-3.5" aria-hidden />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for the backend to confirm the analysis run…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HealthCard() {
  const overview = useWorkspace((s) => s.overview);
  const analyzed = overview?.stats.filesAnalyzed ?? 0;
  const pending = overview?.stats.filesPending ?? 0;
  const recs = overview?.stats.pendingRecommendations ?? 0;
  const errors = overview?.attention.filter((a) => a.severity === "error").length ?? 0;

  const label = errors > 0 ? "Needs attention" : recs > 0 ? "Review waiting" : analyzed > 0 && pending === 0 ? "Healthy" : "Getting started";
  const tone =
    errors > 0 ? "bg-moss-error-bg text-moss-error-fg" : recs > 0 || pending > 0 ? "bg-moss-warn-bg text-moss-warn-fg" : "bg-moss-ok-bg text-moss-ok-fg";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">Workspace health</p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        {analyzed} of {analyzed + pending} files analyzed
        {errors > 0 ? `, ${errors} extraction error` : ""}
        {recs > 0 ? `, ${recs} suggestion${recs === 1 ? "" : "s"} awaiting review` : ", no suggestions waiting"}.
        {" "}Health reflects analysis coverage and open reviews — it never guesses about your files' importance.
      </p>
    </div>
  );
}

export function OverviewPage() {
  usePageTitle("Overview");
  const router = useRouter();
  const overview = useWorkspace((s) => s.overview);
  const files = useWorkspace((s) => s.files);
  const settings = useWorkspace((s) => s.settings);
  const analysisRunning = useWorkspace((s) => s.analysisRun?.state === "running");
  const scanStarting = useWorkspace((s) => s.scanStarting);
  const startScan = useWorkspace((s) => s.startScan);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const [refreshing, setRefreshing] = React.useState(false);

  const go = (route: string) => router.navigate(route);
  const fileById = React.useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  const runScan = async (rescanAll: boolean) => {
    try {
      await startScan(rescanAll);
    } catch (error) {
      toast({
        title: "Analysis could not start",
        description: error instanceof Error ? error.message : "Unexpected error. Try again.",
        variant: "destructive",
      });
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
    toast({ title: "Workspace data refreshed" });
  };

  if (!settings?.workspacePath) {
    return (
      <div className="py-10">
        <PageHeader title="No workspace configured" description="Moss needs one authorized folder to tend. Set it up once and everything else follows." />
        <div className="mt-8">
          <Button asChild className="rounded-lg">
            <Link to="/app/onboarding">Open the setup guide</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={settings.workspaceName}
        description={`Authorized workspace: ${settings.workspacePath} · Last analyzed ${formatRelative(overview?.stats.lastAnalyzedAt)}`}
        badge={overview ? undefined : null}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} aria-hidden />
              Refresh
            </Button>
            <Button
              size="sm"
              className="rounded-lg"
              disabled={analysisRunning || scanStarting}
              onClick={() => void runScan(false)}
            >
              {analysisRunning || scanStarting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <Play className="mr-1.5 size-3.5" aria-hidden />}
              {analysisRunning ? "Analyzing…" : "Analyze workspace"}
            </Button>
          </>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Files analyzed"
          value={overview?.stats.filesAnalyzed ?? "—"}
          hint={overview?.stats.filesPending ? `${overview.stats.filesPending} pending` : "All files processed"}
          icon={ScanSearch}
        />
        <StatCard label="Semantic groups" value={overview?.stats.semanticGroups ?? "—"} hint="AI-suggested + confirmed" icon={Layers} onFollow={() => go("/app/collections")} />
        <StatCard
          label="Duplicate candidates"
          value={overview?.stats.duplicateCandidates ?? "—"}
          hint="Nothing deleted automatically"
          icon={SplitSquareVertical}
          tone={(overview?.stats.duplicateCandidates ?? 0) > 0 ? "attention" : "default"}
          onFollow={() => go("/app/duplicates")}
        />
        <StatCard
          label="Action items"
          value={overview?.stats.actionItems ?? "—"}
          hint="Extracted from your documents"
          icon={ListChecks}
          onFollow={() => go("/app/action-items")}
        />
        <StatCard
          label="Awaiting review"
          value={overview?.stats.pendingRecommendations ?? "—"}
          hint="Approve, edit, or reject"
          icon={CheckCircle2}
          tone={(overview?.stats.pendingRecommendations ?? 0) > 0 ? "attention" : "default"}
          onFollow={() => go("/app/recommendations")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          {/* Attention */}
          <section aria-labelledby="attention-heading" className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b border-moss-line px-5 py-3.5">
              <h2 id="attention-heading" className="text-sm font-semibold text-foreground">
                Needs attention
              </h2>
              {overview?.attention.length ? (
                <span className="rounded-full bg-moss-warn-bg px-2 py-0.5 text-xs font-medium text-moss-warn-fg">
                  {overview.attention.length}
                </span>
              ) : null}
            </div>
            {overview?.attention.length ? (
              <ul className="divide-y divide-moss-line/70">
                {overview.attention.map((item) => (
                  <li key={item.fileId}>
                    <button
                      type="button"
                      onClick={() => go(`/app/inbox?file=${item.fileId}`)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-moss-mint/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      {fileById.get(item.fileId) ? (
                        <FileTypeGlyph kind={fileById.get(item.fileId)!.kind} size="sm" />
                      ) : (
                        <FileWarning className="size-4 text-moss-sage" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{item.fileName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.reason}</span>
                      </span>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          item.severity === "error" ? "bg-moss-error-fg" : item.severity === "warning" ? "bg-moss-warn-fg" : "bg-moss-sage",
                        )}
                        aria-label={item.severity}
                      />
                      <ChevronRight className="size-4 shrink-0 text-moss-sage" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-moss-ok-fg" aria-hidden />
                Nothing needs attention right now.
              </p>
            )}
          </section>

          {/* Relationships */}
          <section aria-labelledby="relations-heading" className="rounded-xl border bg-card">
            <div className="border-b border-moss-line px-5 py-3.5">
              <h2 id="relations-heading" className="text-sm font-semibold text-foreground">
                Recently discovered relationships
              </h2>
            </div>
            {overview?.recentRelationships.length ? (
              <ul className="divide-y divide-moss-line/70">
                {overview.recentRelationships.map((rel) => (
                  <li key={rel.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/app/inbox?file=${rel.sourceFileId}`}
                        className="min-w-0 truncate rounded-sm text-sm font-medium text-foreground hover:text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {fileById.get(rel.sourceFileId)?.name ?? rel.sourceFileId}
                      </Link>
                      <Sparkles className="size-3 shrink-0 text-moss-sage" aria-hidden />
                      <Link
                        to={`/app/inbox?file=${rel.targetFileId}`}
                        className="min-w-0 truncate rounded-sm text-sm font-medium text-foreground hover:text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {fileById.get(rel.targetFileId)?.name ?? rel.targetFileId}
                      </Link>
                      <span className="ml-auto shrink-0 rounded bg-moss-info-bg px-1.5 py-0.5 font-mono text-[0.68rem] text-moss-info-fg">
                        {rel.similarity.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{rel.rationale}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Relationships appear here after the first analysis.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <HealthCard />

          {/* Quick actions */}
          <section aria-labelledby="quick-heading" className="rounded-xl border bg-card p-5">
            <h2 id="quick-heading" className="text-sm font-semibold text-foreground">
              Quick actions
            </h2>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" size="sm" className="justify-start rounded-lg" onClick={() => void runScan(true)} disabled={analysisRunning || scanStarting}>
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                Rescan every file (full analysis)
              </Button>
              <Button variant="outline" size="sm" className="justify-start rounded-lg" onClick={() => go("/app/inbox")}>
                Browse all files
              </Button>
              <Button variant="outline" size="sm" className="justify-start rounded-lg" onClick={() => go("/app/recommendations")}>
                Open the review queue
              </Button>
              <Button variant="outline" size="sm" className="justify-start rounded-lg" onClick={() => go("/app/activity")}>
                View activity history
              </Button>
            </div>
          </section>

          {/* Recent activity */}
          <section aria-labelledby="recent-activity-heading" className="rounded-xl border bg-card">
            <div className="border-b border-moss-line px-5 py-3.5">
              <h2 id="recent-activity-heading" className="text-sm font-semibold text-foreground">
                Recent activity
              </h2>
            </div>
            {overview?.recentActivity.length ? (
              <ul className="divide-y divide-moss-line/70">
                {overview.recentActivity.map((event) => (
                  <li key={event.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Info className="size-3.5 shrink-0 text-moss-sage" aria-hidden />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{event.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(event.createdAt)}</span>
                    </div>
                    {event.outcome !== "success" ? (
                      <p className={cn("mt-0.5 text-xs", event.outcome === "failure" ? "text-moss-error-fg" : "text-moss-warn-fg")}>
                        {event.outcome === "failure" ? "Failed" : "Completed partially"} — see Activity for details.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Activity will appear here as you use Moss.</p>
            )}
            <div className="border-t border-moss-line px-5 py-3">
              <Link to="/app/activity" className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Open full history
                <ChevronRight className="size-3" aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      </div>

      <AnalysisDialog />
    </div>
  );
}

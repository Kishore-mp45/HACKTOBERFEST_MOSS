"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Leaf,
  Loader2,
  RefreshCw,
  ServerCog,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MossMark } from "@/components/moss/logo";
import { FileTypeGlyph, fileKindMeta } from "@/components/moss/file-icon";
import { useWorkspace } from "@/store/workspace";
import { Link, useRouter } from "@/lib/router";
import { usePageTitle } from "@/hooks/moss";
import type { FileKind, LocalRuntime } from "@/types/domain";
import { cn } from "@/lib/utils";
import { API_MODE, mossApi } from "@/lib/api/client";

/**
 * First-run setup: workspace authorization, file formats, local AI check, and
 * the first analysis. Every step offers validation, retry, and skip paths.
 */

const DEMO_KINDS: FileKind[] = ["pdf", "docx", "md", "txt", "xlsx", "csv", "image"];
const LIVE_KINDS: FileKind[] = ["pdf", "docx", "md", "txt"];

const STEPS = ["Welcome", "Workspace", "File formats", "Local AI", "First scan"] as const;

function StepDots({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Setup progress: step ${current + 1} of ${STEPS.length}`}>
      {STEPS.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "hidden text-xs font-medium sm:inline",
              index === current ? "text-moss-forest" : index < current ? "text-moss-ok-fg" : "text-muted-foreground",
            )}
          >
            {step}
          </span>
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full transition-colors",
              index === current ? "bg-moss-forest" : index < current ? "bg-moss-moss" : "bg-moss-line",
            )}
          />
          {index < STEPS.length - 1 ? <span aria-hidden className="h-px w-4 bg-moss-line" /> : null}
        </li>
      ))}
    </ol>
  );
}

function Shell({
  step,
  title,
  description,
  children,
  footer,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Moss — back to landing page">
          <MossMark size={28} />
          <span className="text-sm font-semibold">Moss</span>
        </Link>
        <StepDots current={step} />
      </div>

      <div className="mt-12 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-8">{children}</div>
      </div>

      <div className="mt-12 flex items-center justify-between gap-3 border-t border-moss-line pt-6">{footer}</div>
    </div>
  );
}

export function Onboarding() {
  usePageTitle("Welcome");
  const router = useRouter();
  const saveSettings = useWorkspace((s) => s.saveSettings);
  const setOnboarded = useWorkspace((s) => s.setOnboarded);
  const startScan = useWorkspace((s) => s.startScan);

  const [step, setStep] = React.useState(0);

  // Step 1 — workspace
  const [path, setPath] = React.useState("~/Documents/garden");
  const [name, setName] = React.useState("Garden");
  const [pathError, setPathError] = React.useState<string | null>(null);
  const [authorizing, setAuthorizing] = React.useState(false);
  const [authorized, setAuthorized] = React.useState(false);
  const [directoryPath, setDirectoryPath] = React.useState<string | null>(null);
  const [directoryEntries, setDirectoryEntries] = React.useState<
    { name: string; path: string }[]
  >([]);
  const [browsing, setBrowsing] = React.useState(false);
  const [browseError, setBrowseError] = React.useState<string | null>(null);

  // Step 2 — formats
  const [kinds, setKinds] = React.useState<FileKind[]>(
    API_MODE === "live" ? LIVE_KINDS : ["pdf", "docx", "md", "txt", "xlsx"],
  );
  const [exclusions, setExclusions] = React.useState(
    API_MODE === "live" ? "" : "node_modules, .git, ~$*, *.tmp",
  );
  const [kindError, setKindError] = React.useState<string | null>(null);

  // Step 3 — runtime
  const [runtime, setRuntime] = React.useState<LocalRuntime | null>(null);
  const [checking, setChecking] = React.useState(false);

  const [finishing, setFinishing] = React.useState(false);
  const [scanRequested, setScanRequested] = React.useState(false);
  const [finishError, setFinishError] = React.useState<string | null>(null);

  const validateAndAuthorize = async () => {
    setPathError(null);
    const trimmed = path.trim();
    if (!trimmed) {
      setPathError("Choose the folder Moss is allowed to organize.");
      return;
    }
    if (!/^[~/]/.test(trimmed) && !/^([A-Za-z]:\\|\/)/.test(trimmed)) {
      setPathError("Enter an absolute path (starting with ~ or /). Relative folders cannot be authorized safely.");
      return;
    }
    setAuthorizing(true);
    try {
      await mossApi.configureWorkspace(trimmed, name.trim() || "Workspace");
      setAuthorized(true);
    } catch (error) {
      setPathError(error instanceof Error ? error.message : "The backend could not authorize this folder.");
    } finally {
      setAuthorizing(false);
    }
  };

  const runRuntimeCheck = async () => {
    setChecking(true);
    try {
      setRuntime(await mossApi.checkRuntime());
    } catch (error) {
      setRuntime({
        provider: "Ollama",
        status: "unavailable",
        modelId: null,
        detail: error instanceof Error ? error.message : "Could not query the configured local runtime.",
        lastCheckedAt: new Date().toISOString(),
      });
    } finally {
      setChecking(false);
    }
  };

  const browse = async (nextPath?: string) => {
    setBrowsing(true);
    setBrowseError(null);
    try {
      const listing = await mossApi.browseDirectories(nextPath);
      setDirectoryPath(listing.path);
      setDirectoryEntries(listing.entries);
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : "Could not browse this location.");
    } finally {
      setBrowsing(false);
    }
  };

  const finish = async (withScan: boolean) => {
    setFinishing(true);
    setScanRequested(withScan);
    setFinishError(null);
    try {
      await saveSettings({
        workspacePath: path.trim(),
        workspaceName: name.trim() || "Workspace",
        includedTypes: kinds,
        exclusions: exclusions
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        modelId: runtime?.status === "available" ? runtime.modelId : null,
        allowTelemetry: false,
        keepCache: true,
      });
      setOnboarded(true);
      if (withScan) {
        await startScan(false);
        router.navigate("/app");
      } else {
        router.navigate("/app");
      }
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : "Could not finish workspace setup.");
      setFinishing(false);
      setScanRequested(false);
    }
  };

  if (step === 0) {
    return (
      <Shell
        step={0}
        title="Welcome to Moss"
        description="Moss is a local-first AI agent that reads your documents, connects related information, surfaces forgotten tasks, and proposes organization — always with your approval."
        footer={
          <>
            <Button
              variant="ghost"
              className="rounded-lg text-muted-foreground"
              onClick={() => {
                setOnboarded(true);
                router.navigate("/app");
              }}
            >
              {API_MODE === "mock" ? "Skip — explore the demo workspace" : "Skip setup"}
            </Button>
            <Button className="rounded-lg" onClick={() => setStep(1)}>
              Start setup
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Button>
          </>
        }
      >
        <ul className="space-y-3">
          {[
            { icon: FolderOpen, text: "Point Moss at one authorized folder — your workspace." },
            { icon: FileCheck2, text: "Choose which file types to include in analysis." },
            { icon: ServerCog, text: "Check your local AI runtime, or finish setup and decide later." },
            { icon: Leaf, text: "Run your first analysis and review what grew out of it." },
          ].map((item) => (
            <li key={item.text} className="flex items-center gap-3 rounded-lg border border-moss-line bg-card p-3.5">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-moss-mint text-moss-forest">
                <item.icon className="size-4" aria-hidden />
              </span>
              <p className="text-sm text-foreground">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-lg bg-moss-mint/50 px-4 py-3 text-xs leading-relaxed text-moss-forest">
          The browser never touches your filesystem directly — authorization is granted to and enforced by the
          Moss backend on your machine.
        </p>
      </Shell>
    );
  }

  if (step === 1) {
    return (
      <Shell
        step={1}
        title="Which folder should Moss tend?"
        description="Moss organizes exactly one authorized workspace — nothing outside it is ever read or changed."
        footer={
          <>
            <Button variant="ghost" className="rounded-lg" onClick={() => setStep(0)}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="rounded-lg text-muted-foreground"
                onClick={() => {
                  setOnboarded(true);
                  router.navigate("/app");
                }}
              >
                Skip for now
              </Button>
              <Button
                className="rounded-lg"
                disabled={authorizing || authorized}
                onClick={() => void validateAndAuthorize()}
              >
                {authorizing ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : null}
                {authorizing ? "Authorizing…" : authorized ? "Workspace authorized" : "Authorize workspace"}
              </Button>
              {authorized ? (
                <Button className="rounded-lg" onClick={() => setStep(2)}>
                  Continue
                </Button>
              ) : null}
            </div>
          </>
        }
      >
        <div className="space-y-5 rounded-xl border border-moss-line bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="workspace-path">Workspace folder</Label>
            <Input
              id="workspace-path"
              value={path}
              onChange={(event) => {
                setPath(event.target.value);
                setAuthorized(false);
                setPathError(null);
              }}
              placeholder="~/Documents/garden"
              className="font-mono text-sm"
              aria-invalid={Boolean(pathError)}
              aria-describedby={pathError ? "workspace-path-error" : undefined}
            />
            {pathError ? (
              <p id="workspace-path-error" role="alert" className="flex items-center gap-1.5 text-xs text-moss-error-fg">
                <TriangleAlert className="size-3.5" aria-hidden />
                {pathError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Use an absolute path. The backend will verify real access.</p>
            )}
            {API_MODE === "live" ? (
              <div className="space-y-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={browsing}
                  onClick={() => void browse()}
                >
                  {browsing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : null}
                  {browsing ? "Loading folders…" : "Browse folders"}
                </Button>
                {browseError ? <p role="alert" className="text-xs text-moss-error-fg">{browseError}</p> : null}
                {directoryPath ? (
                  <div className="rounded-lg border border-moss-line p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-all font-mono text-xs text-muted-foreground">{directoryPath}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 rounded-lg"
                        onClick={() => {
                          setPath(directoryPath);
                          setAuthorized(false);
                        }}
                      >
                        Use this folder
                      </Button>
                    </div>
                    {directoryEntries.length ? (
                      <ul className="mt-3 max-h-40 space-y-1 overflow-auto border-t border-moss-line pt-2">
                        {directoryEntries.map((entry) => (
                          <li key={entry.path}>
                            <button
                              type="button"
                              className="w-full truncate rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-moss-mint/60"
                              onClick={() => void browse(entry.path)}
                            >
                              <FolderOpen className="mr-2 inline size-3.5 text-moss-moss" aria-hidden />
                              {entry.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 border-t border-moss-line pt-2 text-xs text-muted-foreground">
                        No subfolders were found here.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Garden"
            />
          </div>
          {authorized ? (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-moss-ok-bg px-3.5 py-2.5 text-sm text-moss-ok-fg">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{path.trim()}</span> is ready — the backend confirmed access.
                {API_MODE === "mock" ? (
                  <span className="ml-1 text-moss-ok-fg/80">(Simulated in demo mode.)</span>
                ) : null}
              </span>
            </p>
          ) : null}
        </div>
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell
        step={2}
        title="Which file types should Moss understand?"
        description={
          API_MODE === "live"
            ? "The connected backend currently analyzes PDF, Word, Markdown, and plain-text files. Per-workspace type filters and exclusions are not yet applied."
            : "Demo mode includes sample documents across PDF, Word, Markdown, plain text, Excel, CSV, and image formats."
        }
        footer={
          <>
            <Button variant="ghost" className="rounded-lg" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="rounded-lg text-muted-foreground"
                onClick={() => {
                  setOnboarded(true);
                  router.navigate("/app");
                }}
              >
                Skip for now
              </Button>
              <Button
                className="rounded-lg"
                onClick={() => {
                  if (kinds.length === 0) {
                    setKindError("Select at least one file type to analyze.");
                    return;
                  }
                  setKindError(null);
                  setStep(3);
                }}
              >
                Continue
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Button>
            </div>
          </>
        }
      >
        <fieldset className="rounded-xl border border-moss-line bg-card p-6">
          <legend className="sr-only">Included file types</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(API_MODE === "live" ? LIVE_KINDS : DEMO_KINDS).map((kind) => {
              const checked = kinds.includes(kind);
              return (
                <Label
                  key={kind}
                  htmlFor={`kind-${kind}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors",
                    checked ? "border-moss-moss bg-moss-mint/50 text-moss-forest" : "border-moss-line text-muted-foreground hover:border-moss-sage",
                  )}
                >
                  <Checkbox
                    id={`kind-${kind}`}
                    checked={checked}
                    disabled={API_MODE === "live"}
                    onCheckedChange={(next) =>
                      setKinds((current) =>
                        next ? [...current, kind] : current.filter((k) => k !== kind),
                      )
                    }
                  />
                  <FileTypeGlyph kind={kind} size="sm" />
                  {fileKindMeta[kind].label}
                </Label>
              );
            })}
          </div>
          {kindError ? (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-moss-error-fg">
              <TriangleAlert className="size-3.5" aria-hidden />
              {kindError}
            </p>
          ) : null}
        </fieldset>
        <div className="mt-5 space-y-2">
          <Label htmlFor="exclusions">Always exclude (comma-separated patterns)</Label>
          <Input
            id="exclusions"
            value={exclusions}
            onChange={(event) => setExclusions(event.target.value)}
            placeholder="node_modules, .git, ~$*, *.tmp"
            className="font-mono text-sm"
            disabled={API_MODE === "live"}
          />
          <p className="text-xs text-muted-foreground">
            {API_MODE === "live"
              ? "Exclusion patterns are not applied by the current backend."
              : "These folders and files are skipped during discovery in the demo."}
          </p>
        </div>
      </Shell>
    );
  }

  if (step === 3) {
    return (
      <Shell
        step={3}
        title="Check your local AI"
        description={
          API_MODE === "mock"
            ? "Moss uses sample data in demo mode. Test the local runtime any time, or continue exploring."
            : "Moss uses open-weight models through the configured local runtime. Test availability now, or finish setup and retry later."
        }
        footer={
          <>
            <Button variant="ghost" className="rounded-lg" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-lg text-muted-foreground" onClick={() => setStep(4)}>
                Skip this step
              </Button>
              <Button className="rounded-lg" disabled={checking} onClick={() => void runRuntimeCheck()}>
                {checking ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-1 size-4" aria-hidden />}
                {checking ? "Testing…" : runtime ? "Retry check" : "Test connection"}
              </Button>
              {runtime ? (
                <Button className="rounded-lg" onClick={() => setStep(4)}>
                  Continue
                </Button>
              ) : null}
            </div>
          </>
        }
      >
        <div className="rounded-xl border border-moss-line bg-card p-6">
          {!runtime && !checking ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              The test probes the runtime address configured for your deployment (for example a local Ollama
              instance) and reports the verified result — including when nothing is found.
            </p>
          ) : null}
          {checking ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Probing the configured runtime…
            </p>
          ) : null}
          {runtime ? (
            <div role="status" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{runtime.provider}</p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    runtime.status === "available"
                      ? "bg-moss-ok-bg text-moss-ok-fg"
                      : "bg-moss-warn-bg text-moss-warn-fg",
                  )}
                >
                  {runtime.status === "available" ? "Available" : "Not detected"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{runtime.detail}</p>
              {runtime.status !== "available" ? (
                <p className="rounded-lg bg-moss-mint/50 px-3.5 py-2.5 text-xs leading-relaxed text-moss-forest">
                  {API_MODE === "live"
                    ? "You can finish setup, but a live analysis needs the configured Ollama models to be available. Test the connection again any time from Settings."
                    : "You can continue in demo mode with clearly-labelled sample data, and test the connection again any time from Settings."}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      step={4}
      title="You're set. Let's grow."
      description="Here's the configuration Moss will use. Run the first analysis now, or explore first and scan whenever you like."
      footer={
        <>
          <Button variant="ghost" className="rounded-lg" onClick={() => setStep(3)}>
            <ArrowLeft className="mr-1 size-4" aria-hidden />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-lg" disabled={finishing} onClick={() => void finish(false)}>
              I'll scan later
            </Button>
            <Button className="rounded-lg" disabled={finishing} onClick={() => void finish(true)}>
              {finishing ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                  {scanRequested ? "Starting…" : "Saving…"}
                </>
              ) : (
                <>
                  Run first analysis
                  <ArrowRight className="ml-1 size-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </>
      }
    >
      {finishError ? (
        <p role="alert" className="mb-4 rounded-lg border border-moss-error-bg bg-moss-error-bg/60 px-3.5 py-2.5 text-sm text-moss-error-fg">
          {finishError}
        </p>
      ) : null}
      <dl className="divide-y divide-moss-line rounded-xl border border-moss-line bg-card px-5">
        {[
          ["Workspace", `${name.trim() || "Workspace"} — ${path.trim()}`],
          ["File types", kinds.map((kind) => fileKindMeta[kind].label).join(", ") || "—"],
          ["Exclusions", exclusions.trim() || "None"],
          ["Local AI", runtime ? (runtime.status === "available" ? `${runtime.provider} · ${runtime.modelId}` : `${runtime.provider} — not detected`) : API_MODE === "live" ? "Not checked" : "Demo mode (not tested)"],
        ].map(([term, detail]) => (
          <div key={term} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:justify-between">
            <dt className="text-sm font-medium text-foreground">{term}</dt>
            <dd className="break-all text-sm text-muted-foreground sm:max-w-md sm:text-right">{detail}</dd>
          </div>
        ))}
      </dl>
    </Shell>
  );
}

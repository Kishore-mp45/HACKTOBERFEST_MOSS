"use client";

import * as React from "react";
import {
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  FlaskConical,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  SunMedium,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/moss/primitives";
import { FileTypeGlyph, fileKindMeta } from "@/components/moss/file-icon";
import { useWorkspace } from "@/store/workspace";
import { useRouter } from "@/lib/router";
import { usePageTitle, useTheme } from "@/hooks/moss";
import { formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/types/domain";
import { API_MODE } from "@/lib/api/client";

const DEMO_KINDS: FileKind[] = ["pdf", "docx", "md", "txt", "xlsx", "csv", "image"];
const LIVE_KINDS: FileKind[] = ["pdf", "docx", "md", "txt"];

function Card({
  title,
  description,
  icon: Icon,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b border-moss-line/70 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-moss-moss" aria-hidden />
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="p-5">{children}</div>
      {footer ? <div className="flex items-center justify-between gap-3 border-t border-moss-line/70 bg-moss-ivory/40 px-5 py-3.5">{footer}</div> : null}
    </section>
  );
}

export function SettingsPage() {
  usePageTitle("Settings");
  const router = useRouter();
  const settings = useWorkspace((s) => s.settings);
  const runtime = useWorkspace((s) => s.runtime);
  const runtimeChecking = useWorkspace((s) => s.runtimeChecking);
  const checkRuntime = useWorkspace((s) => s.checkRuntime);
  const saveSettings = useWorkspace((s) => s.saveSettings);
  const apiMode = useWorkspace((s) => s.apiMode);
  const setDemoMode = useWorkspace((s) => s.setDemoMode);
  const { theme, setTheme } = useTheme();

  const [path, setPath] = React.useState("");
  const [name, setName] = React.useState("");
  const [pathError, setPathError] = React.useState<string | null>(null);
  const [kinds, setKinds] = React.useState<FileKind[]>([]);
  const [exclusions, setExclusions] = React.useState("");
  const [kindError, setKindError] = React.useState<string | null>(null);
  const [savingWorkspace, setSavingWorkspace] = React.useState(false);
  const [savingAnalysis, setSavingAnalysis] = React.useState(false);

  React.useEffect(() => {
    if (!settings) return;
    setPath(settings.workspacePath ?? "");
    setName(settings.workspaceName);
    setKinds(settings.includedTypes);
    setExclusions(settings.exclusions.join(", "));
  }, [settings]);

  if (!settings) {
    return (
      <div className="space-y-5">
        <PageHeader title="Settings" description="Workspace configuration, local AI status, and appearance." />
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading settings…
        </p>
      </div>
    );
  }

  const workspaceDirty = path !== (settings.workspacePath ?? "") || name !== settings.workspaceName;
  const analysisDirty =
    JSON.stringify([...kinds].sort()) !== JSON.stringify([...settings.includedTypes].sort()) ||
    exclusions !== settings.exclusions.join(", ");

  const saveWorkspace = async () => {
    setPathError(null);
    const trimmed = path.trim();
    if (!trimmed) {
      setPathError("The workspace folder cannot be empty.");
      return;
    }
    if (!/^(?:[A-Za-z]:\\|[~/])/.test(trimmed)) {
      setPathError("Use an absolute path (starting with ~ or /).");
      return;
    }
    setSavingWorkspace(true);
    try {
      await saveSettings({ ...settings, workspacePath: trimmed, workspaceName: name.trim() || "Workspace" });
      toast({ title: "Workspace updated", description: "The backend will use the new path for the next analysis." });
    } catch (error) {
      toast({
        title: "Could not save workspace settings",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const saveAnalysis = async () => {
    setKindError(null);
    if (kinds.length === 0) {
      setKindError("Select at least one file type.");
      return;
    }
    setSavingAnalysis(true);
    try {
      await saveSettings({
        ...settings,
        includedTypes: kinds,
        exclusions: exclusions.split(",").map((entry) => entry.trim()).filter(Boolean),
      });
      toast({ title: "Analysis settings saved", description: "Changes apply from the next scan onwards." });
    } catch (error) {
      toast({
        title: "Could not save analysis settings",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingAnalysis(false);
    }
  };

  const testRuntime = async () => {
    try {
      await checkRuntime();
    } catch (error) {
      toast({
        title: "Could not check local AI",
        description: error instanceof Error ? error.message : "The backend could not verify the runtime.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace configuration, supported formats, local AI status, and appearance." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Workspace"
          description="The one folder Moss is authorized to read and organize. Authorization is enforced by the backend, never by the browser."
          icon={MapPin}
          footer={
            <>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg text-muted-foreground"
                onClick={() => router.navigate("/app/onboarding")}
              >
                Re-run setup guide
              </Button>
              <Button size="sm" className="rounded-lg" disabled={!workspaceDirty || savingWorkspace} onClick={() => void saveWorkspace()}>
                {savingWorkspace ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <Save className="mr-1.5 size-3.5" aria-hidden />}
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-path">Workspace folder</Label>
              <Input
                id="settings-path"
                value={path}
                onChange={(event) => {
                  setPath(event.target.value);
                  setPathError(null);
                }}
                className={cn("font-mono text-sm", pathError && "border-moss-error-fg")}
                aria-invalid={Boolean(pathError)}
              />
              {pathError ? (
                <p role="alert" className="flex items-center gap-1.5 text-xs text-moss-error-fg">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {pathError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-name">Workspace name</Label>
              <Input id="settings-name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
            </div>
          </div>
        </Card>

        <Card
          title="Analysis & file types"
          description="Which formats participate in analysis, and which patterns are always skipped during discovery."
          icon={Database}
          footer={
            <>
              <span className="text-xs text-muted-foreground">
                {kinds.length} of {(apiMode === "live" ? LIVE_KINDS : DEMO_KINDS).length} types included
              </span>
              <Button size="sm" className="rounded-lg" disabled={!analysisDirty || savingAnalysis} onClick={() => void saveAnalysis()}>
                {savingAnalysis ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <Save className="mr-1.5 size-3.5" aria-hidden />}
                Save
              </Button>
            </>
          }
        >
          {apiMode === "live" ? (
            <p className="mb-4 rounded-lg bg-moss-warn-bg/60 px-3.5 py-2.5 text-xs leading-relaxed text-moss-warn-fg">
              The connected backend currently uses its supported parsers directly and does not apply per-workspace file filters or exclusion patterns.
            </p>
          ) : null}
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included types</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(apiMode === "live" ? LIVE_KINDS : DEMO_KINDS).map((kind) => (
                  <Label
                    key={kind}
                    htmlFor={`settings-kind-${kind}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs font-medium",
                      kinds.includes(kind) ? "border-moss-moss bg-moss-mint/50 text-moss-forest" : "text-muted-foreground",
                    )}
                  >
                    <Checkbox
                      id={`settings-kind-${kind}`}
                      checked={kinds.includes(kind)}
                      disabled={apiMode === "live"}
                      onCheckedChange={(next) => {
                        setKinds((current) => (next ? [...current, kind] : current.filter((k) => k !== kind)));
                        setKindError(null);
                      }}
                    />
                    <FileTypeGlyph kind={kind} size="sm" />
                    {fileKindMeta[kind].label}
                  </Label>
                ))}
              </div>
              {kindError ? (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-moss-error-fg">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {kindError}
                </p>
              ) : null}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="settings-exclusions">Exclusions (comma-separated patterns)</Label>
              <Input
                id="settings-exclusions"
                value={exclusions}
                onChange={(event) => setExclusions(event.target.value)}
                className="font-mono text-sm"
                disabled={apiMode === "live"}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Local AI runtime"
          description="Verified status of your configured inference runtime. Moss reports what it detects — it never assumes a model is running."
          icon={Cpu}
          footer={
            <>
              <span className="text-xs text-muted-foreground">
                {runtime?.lastCheckedAt ? `Last checked ${formatRelative(runtime.lastCheckedAt)}` : "Not checked yet"}
              </span>
              <Button size="sm" variant="outline" className="rounded-lg" disabled={runtimeChecking} onClick={() => void testRuntime()}>
                {runtimeChecking ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="mr-1.5 size-3.5" aria-hidden />}
                Test connection
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3.5">
              <div>
                <p className="text-sm font-medium text-foreground">{runtime?.provider ?? "Not configured"}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {runtime?.modelId ? `model: ${runtime.modelId}` : "no model selected"}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  runtime?.status === "available"
                    ? "bg-moss-ok-bg text-moss-ok-fg"
                    : runtime?.status === "checking"
                      ? "bg-moss-info-bg text-moss-info-fg"
                      : "bg-moss-warn-bg text-moss-warn-fg",
                )}
                role="status"
              >
                {runtimeChecking
                  ? "Checking…"
                  : runtime?.status === "available"
                    ? "Available"
                    : runtime?.status === "checking"
                      ? "Checking"
                      : "Not connected"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {runtime?.detail ??
                "Run the connection test to probe the configured runtime address and report the verified result."}
            </p>
            <p className="rounded-lg bg-moss-mint/50 px-3.5 py-2.5 text-xs leading-relaxed text-moss-forest">
              {apiMode === "mock"
                ? "This deployment runs in demo mode: analysis results are synthetic fixtures and no runtime is contacted. Configure NEXT_PUBLIC_MOSS_API_URL to connect a real Moss backend."
                : "Connected to a live Moss backend. Analysis runs according to the backend's configured pipeline."}
            </p>
          </div>
        </Card>

        <div className="space-y-5">
          <Card
            title="Privacy & cache"
            description="Moss stores document content only as long as analysis needs it. Nothing is sent to third-party services by the frontend."
            icon={ShieldCheck}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="telemetry" className="text-sm">Share anonymous usage statistics</Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Off by default. In a self-hosted setup this controls optional, anonymized diagnostics — never document content.
                  </p>
                </div>
                <Switch id="telemetry" checked={settings.allowTelemetry} disabled onCheckedChange={() => {}} />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="cache" className="text-sm">Keep analysis cache</Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Speeds up rescans by reusing previous text extraction. Disable to clear cached content after each run.
                  </p>
                </div>
                <Switch
                  id="cache"
                  checked={settings.keepCache}
                  onCheckedChange={async (next) => {
                    try {
                      await saveSettings({ ...settings, keepCache: next });
                      toast({ title: next ? "Cache enabled" : "Cache disabled" });
                    } catch {
                      toast({ title: "Could not update cache setting", variant: "destructive" });
                    }
                  }}
                />
              </div>
            </div>
          </Card>

          <Card
            title="Appearance"
            description="Moss follows a calm, garden-inspired palette. Choose the surface that suits your room."
            icon={SunMedium}
          >
            <RadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark")} className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "light", label: "Daylight", hint: "Ivory surfaces, forest accents" },
                  { value: "dark", label: "Night garden", hint: "Deep, dimmed forest tones" },
                ] as const
              ).map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`theme-${option.value}`}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-lg border p-3.5",
                    theme === option.value ? "border-moss-moss bg-moss-mint/40" : "hover:border-moss-sage",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <RadioGroupItem id={`theme-${option.value}`} value={option.value} />
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </Label>
              ))}
            </RadioGroup>
          </Card>

          <Card
            title="Demo & Presentation Mode"
            description="Toggle between instant synthetic presentation data and the live local Ollama model backend."
            icon={FlaskConical}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="demo-mode-switch" className="text-sm font-medium">
                  {apiMode === "mock" ? "Demo Mode is Enabled" : "Live Backend Mode is Enabled"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {apiMode === "mock"
                    ? "Displaying 18 synthetic mock documents across 8 categories with instant interactions and a 5-second simulated analysis pipeline."
                    : "Connecting to the local FastAPI backend (127.0.0.1:8765) with real Ollama inference."}
                </p>
              </div>
              <Switch
                id="demo-mode-switch"
                checked={apiMode === "mock"}
                onCheckedChange={(checked) => {
                  void setDemoMode(checked);
                  toast({
                    title: checked ? "Demo mode enabled" : "Live backend enabled",
                    description: checked
                      ? "Loaded 18 synthetic demo documents and fast simulated analysis."
                      : "Switched to live FastAPI backend.",
                  });
                }}
              />
            </div>
          </Card>

          <div className="rounded-xl border border-moss-line bg-moss-ivory/60 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="size-4 text-moss-ok-fg" aria-hidden />
              Integration status
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Frontend ↔ backend contract: <code className="rounded bg-muted px-1 font-mono">docs/API_CONTRACT.md</code>.
              {apiMode === "mock" ? (
                <>
                  {" "}To connect a live FastAPI server, set{" "}
                  <code className="rounded bg-muted px-1 font-mono">NEXT_PUBLIC_MOSS_API_URL</code> and restart —
                  no frontend code changes are needed.
                </>
              ) : (
                <> A live backend is currently configured.</>
              )}
            </p>
            <a
              href="https://fastapi.tiangolo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ExternalLink className="size-3" aria-hidden />
              About the FastAPI integration target
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

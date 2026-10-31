"use client";

import * as React from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  FlaskConical,
  Gauge,
  Inbox,
  ListChecks,
  Menu,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  SplitSquareVertical,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MossLogo, MossMark } from "@/components/moss/logo";
import { useWorkspace } from "@/store/workspace";
import { Link, useRouter } from "@/lib/router";
import { useTheme } from "@/hooks/moss";
import { cn } from "@/lib/utils";

export const APP_NAV = [
  { path: "/app", label: "Overview", icon: Gauge },
  { path: "/app/inbox", label: "Inbox", icon: Inbox },
  { path: "/app/collections", label: "Collections", icon: FolderTree },
  { path: "/app/action-items", label: "Action Items", icon: ListChecks },
  { path: "/app/duplicates", label: "Duplicates", icon: SplitSquareVertical },
  { path: "/app/recommendations", label: "Review Queue", icon: CheckCircle2 },
  { path: "/app/activity", label: "Activity", icon: ActivityIcon },
  { path: "/app/settings", label: "Settings", icon: SettingsIcon },
] as const;

function countsForNav(state: ReturnType<typeof useWorkspace.getState>) {
  return {
    "/app/inbox": state.files.filter((f) => f.status !== "analyzed").length,
    "/app/action-items": state.actionItems.filter((a) => a.status === "new").length,
    "/app/duplicates": state.duplicates.filter((d) => d.status === "open").length,
    "/app/recommendations": state.recommendations.filter((r) => r.status === "pending").length,
  } as Record<string, number>;
}

function AiStatusChip() {
  const runtime = useWorkspace((s) => s.runtime);
  const checking = useWorkspace((s) => s.runtimeChecking);

  if (checking || runtime?.status === "checking" || runtime?.status === "unknown") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-moss-line bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" aria-hidden />
        Checking local AI…
      </span>
    );
  }
  if (runtime?.status === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-moss-ok-bg px-2.5 py-1 text-xs font-medium text-moss-ok-fg">
        <CheckCircle2 className="size-3" aria-hidden />
        Local AI ready
      </span>
    );
  }
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="status"
            className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-transparent bg-moss-warn-bg px-2.5 py-1 text-xs font-medium text-moss-warn-fg"
          >
            <AlertTriangle className="size-3" aria-hidden />
            Local AI not connected
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs leading-relaxed">
          {runtime?.detail ??
            "No local inference runtime is configured. Run the connection test in Settings."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DemoModeBadge({ className }: { className?: string }) {
  const apiMode = useWorkspace((s) => s.apiMode);
  const setDemoMode = useWorkspace((s) => s.setDemoMode);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void setDemoMode(apiMode !== "mock")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              apiMode === "mock"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                : "border-moss-line bg-muted/50 text-muted-foreground hover:bg-muted",
              className,
            )}
            title="Click to toggle Demo / Live mode"
          >
            <FlaskConical className="size-3" aria-hidden />
            <span>{apiMode === "mock" ? "Demo data" : "Live mode"}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs">
          {apiMode === "mock"
            ? "Demo data active (18 synthetic files, 5s simulated scan). Click to switch to live backend."
            : "Live backend active. Click to switch to instant demo presentation mode."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NavLinks({ onNavigate, layout = "sidebar" }: { onNavigate?: () => void; layout?: "sidebar" | "sheet" }) {
  const path = useRouter().path;
  const counts = countsForNav(useWorkspace());
  return (
    <nav aria-label="Workspace" className={cn("flex flex-col gap-1", layout === "sheet" && "mt-2")}>
      {APP_NAV.map((item) => {
        const active = path === item.path || (item.path !== "/app" && path.startsWith(item.path));
        const count = counts[item.path];
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-moss-forest text-moss-ivory"
                : "text-muted-foreground hover:bg-moss-mint/60 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
                  active ? "bg-white/15 text-moss-ivory" : "bg-moss-mint text-moss-forest",
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:bg-moss-mint/60 hover:text-foreground"
            aria-label={theme === "dark" ? "Switch to light appearance" : "Switch to dark appearance"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Appearance</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const workspaceName = useWorkspace((s) => s.settings?.workspaceName ?? "Workspace");
  const apiMode = useWorkspace((s) => s.apiMode);
  const analysisRun = useWorkspace((s) => s.analysisRun);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-moss-line bg-sidebar lg:flex">
        <div className="border-b border-moss-line px-5 py-4">
          <Link to="/" aria-label="Moss — back to landing page" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <MossLogo size={30} />
          </Link>
          <p className="mt-2 truncate text-xs text-muted-foreground" title={workspaceName}>
            Workspace · <span className="font-medium text-foreground">{workspaceName}</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto slim-scroll px-3 py-4">
          <NavLinks />
        </div>
        <div className="space-y-2 border-t border-moss-line px-4 py-3.5">
          <AiStatusChip />
          <DemoModeBadge />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-moss-line bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {/* Mobile nav */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-moss-line px-5 py-4">
                  <SheetTitle asChild>
                    <div>
                      <Link to="/" aria-label="Moss — back to landing page" onClick={() => setMobileOpen(false)}>
                        <MossMark size={26} />
                        <span className="ml-2 align-middle text-base font-semibold">Moss</span>
                      </Link>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="px-3 py-3">
                  <NavLinks layout="sheet" onNavigate={() => setMobileOpen(false)} />
                </div>
                <div className="absolute inset-x-0 bottom-0 space-y-2 border-t border-moss-line px-4 py-3.5">
                  <AiStatusChip />
                  <DemoModeBadge />
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <Link to="/" aria-label="Moss — back to landing page">
                <MossMark size={26} />
              </Link>
              <span className="truncate text-sm font-semibold">{workspaceName}</span>
            </div>

            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <span className="truncate text-sm font-medium text-muted-foreground">
                {analysisRun?.state === "running" ? "Analysis in progress…" : `Workspace · ${workspaceName}`}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <DemoModeBadge className="hidden sm:inline-flex" />
              <AiStatusChip />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Compass, Home as HomeIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MossMark } from "@/components/moss/logo";
import { Link, RouterProvider, matchRoute, useRouter } from "@/lib/router";
import { useWorkspace } from "@/store/workspace";
import { LandingPage } from "@/features/landing/landing-page";
import { AppShell } from "@/features/workspace/app-shell";
import { Onboarding } from "@/features/workspace/onboarding";
import { OverviewPage } from "@/features/workspace/overview";
import { InboxPage } from "@/features/workspace/inbox";
import { CollectionsPage } from "@/features/workspace/collections";
import { ActionItemsPage } from "@/features/workspace/action-items";
import { DuplicatesPage } from "@/features/workspace/duplicates";
import { RecommendationsPage } from "@/features/workspace/recommendations";
import { ActivityPage } from "@/features/workspace/activity";
import { SettingsPage } from "@/features/workspace/settings";

/* ------------------------------ 404 ------------------------------- */

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <MossMark size={44} />
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-moss-moss">404 · nothing grew here</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">This page doesn't exist</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The address you followed doesn't match any page in Moss. It may have been moved, or the link was
        mistyped.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="rounded-lg">
          <Link to="/">
            <HomeIcon className="mr-1.5 size-4" aria-hidden />
            Back to the landing page
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-lg">
          <Link to="/app">
            <Compass className="mr-1.5 size-4" aria-hidden />
            Open the workspace
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* --------------------------- Error boundary ------------------------ */

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Moss render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <MossMark size={44} />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Something wilted</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            An unexpected error occurred while rendering this view. Your workspace data is untouched —
            reloading usually resolves it.
          </p>
          <p className="mt-3 max-w-md rounded-lg border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          <Button className="mt-6 rounded-lg" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 size-4" aria-hidden />
            Reload Moss
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------ Splash ----------------------------- */

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background" role="status" aria-label="Loading Moss">
      <MossMark size={40} className="animate-pulse" />
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Loading Moss</p>
    </div>
  );
}

/* ------------------------------ Router ----------------------------- */

const APP_ROUTES: { pattern: string; element: React.ReactNode }[] = [
  { pattern: "/app", element: <OverviewPage /> },
  { pattern: "/app/onboarding", element: <Onboarding /> },
  { pattern: "/app/inbox", element: <InboxPage /> },
  { pattern: "/app/collections", element: <CollectionsPage /> },
  { pattern: "/app/action-items", element: <ActionItemsPage /> },
  { pattern: "/app/duplicates", element: <DuplicatesPage /> },
  { pattern: "/app/recommendations", element: <RecommendationsPage /> },
  { pattern: "/app/activity", element: <ActivityPage /> },
  { pattern: "/app/settings", element: <SettingsPage /> },
];

function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <MossMark size={44} />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Moss backend unavailable</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
      <Button className="mt-6 rounded-lg" onClick={onRetry}>
        <RefreshCw className="mr-1.5 size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function WorkspaceRoutes() {
  const { path, navigate } = useRouter();
  const bootStatus = useWorkspace((s) => s.bootStatus);
  const bootError = useWorkspace((s) => s.bootError);
  const onboarded = useWorkspace((s) => s.onboarded);
  const bootstrap = useWorkspace((s) => s.bootstrap);

  // Boot once when the workspace area is entered.
  React.useEffect(() => {
    if (bootStatus === "idle") void bootstrap();
  }, [bootStatus, bootstrap]);

  const hashPath = path.split("?")[0];
  const knownRoute = APP_ROUTES.some((r) => r.pattern === hashPath);

  // First-run guidance: un-onboarded users land on the setup flow.
  React.useEffect(() => {
    if (bootStatus !== "ready") return;
    if (!onboarded && (hashPath === "/app" || !knownRoute)) {
      navigate("/app/onboarding");
    }
  }, [bootStatus, onboarded, hashPath, knownRoute, navigate]);

  if (bootStatus === "error" && hashPath !== "/app/onboarding") {
    return <BootError message={bootError ?? "The workspace could not be loaded."} onRetry={() => void bootstrap()} />;
  }
  if (bootStatus !== "ready") {
    return <Splash />;
  }

  for (const route of APP_ROUTES) {
    if (matchRoute(route.pattern, hashPath)) {
      if (route.pattern === "/app/onboarding") return <Onboarding />;
      return <AppShell>{route.element}</AppShell>;
    }
  }
  return <NotFound />;
}

function RoutedApp() {
  const { path, ready } = useRouter();

  if (!ready) return <Splash />;

  const hashPath = path.split("?")[0];
  if (hashPath === "/" || hashPath === "") return <LandingPage />;
  if (hashPath.startsWith("/app")) return <WorkspaceRoutes />;
  return <NotFound />;
}

export default function MossHomePage() {
  return (
    <AppErrorBoundary>
      <RouterProvider>
        <RoutedApp />
      </RouterProvider>
    </AppErrorBoundary>
  );
}

"use client";

/**
 * Moss — lightweight typed hash router.
 *
 * Why a hash router? This sandboxed preview exposes exactly one filesystem
 * route (`/`). A hash router gives us real, linkable navigation
 * (`/#/app/inbox`), browser back/forward, and refresh-safe deep links while
 * staying inside that single mount point. In a self-hosted checkout the same
 * route table maps 1:1 onto React Router or the Next.js App Router — see
 * docs/ROUTING.md.
 */

import * as React from "react";

export interface RouteMatch {
  path: string;
  params: Record<string, string>;
}

interface RouterContextValue {
  /** Current hash path, always starting with "/". */
  path: string;
  /** False during SSR and the very first client render — prevents hydration mismatches. */
  ready: boolean;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  back: () => void;
}

const RouterContext = React.createContext<RouterContextValue | null>(null);

export function normalizeHash(hash: string): string {
  const raw = hash.replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Pure pattern matcher: "/app/:section" matches "/app/inbox". Exported for unit tests. */
export function matchRoute(pattern: string, path: string): RouteMatch | null {
  const p = pattern.split("/").filter(Boolean);
  const c = path.split("?")[0].split("/").filter(Boolean);
  if (p.length !== c.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(":")) {
      params[p[i].slice(1)] = decodeURIComponent(c[i]);
    } else if (p[i] !== c[i]) {
      return null;
    }
  }
  return { path, params };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = React.useState("/");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const read = () => setPath(normalizeHash(window.location.hash));
    read();
    setReady(true);
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const navigate = React.useCallback((to: string, options?: { replace?: boolean }) => {
    const target = normalizeHash(to);
    const next = `#${target}`;
    if (window.location.hash === next) return;
    if (options?.replace) {
      window.history.replaceState(null, "", next);
      // replaceState does not fire hashchange
      setPath(target);
    } else {
      window.location.hash = target;
    }
  }, []);

  const back = React.useCallback(() => {
    window.history.back();
  }, []);

  const value = React.useMemo(() => ({ path, ready, navigate, back }), [path, ready, navigate, back]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = React.useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <RouterProvider>");
  return ctx;
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

/** Anchor with real href (middle-click / cmd-click friendly) + client-side navigation. */
export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${normalizeHash(to)}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

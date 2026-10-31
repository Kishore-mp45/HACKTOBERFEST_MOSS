# Routing

## Why a hash router in this deployment

The Moss frontend lives in a Next.js 16 (App Router) project, and this
sandboxed preview exposes **exactly one filesystem route**: `/`. To deliver
two full experiences — the public landing page and the workspace app — with
real navigation, deep links, and refresh-safe URLs, the app mounts a small
typed hash router (`src/lib/router.tsx`) at `/`:

| URL hash | Screen |
|----------|--------|
| `#/` | Public landing page (sections A–K) |
| `#/app` | Overview dashboard |
| `#/app/onboarding` | First-run setup (also auto-entered on first `#/app` visit) |
| `#/app/inbox` | Workspace files (`?file=<id>` opens the detail drawer) |
| `#/app/collections` | Semantic document groups |
| `#/app/action-items` | Extracted tasks and deadlines |
| `#/app/duplicates` | Exact / near / semantic duplicate review |
| `#/app/recommendations` | Approval queue and decision history |
| `#/app/activity` | Operation history and undo |
| `#/app/settings` | Workspace, formats, runtime, privacy, appearance |
| anything else | Dedicated 404 view |

The router provides: `RouterProvider`, `useRouter()` (`path`, `navigate`,
`back`), a `<Link>` component that renders real anchors (middle-click /
cmd-click friendly), pattern matching with `:params`, and browser
back/forward support. It renders a splash during SSR/first paint to avoid
hydration mismatches.

## Swapping to filesystem routes in a self-hosted checkout

The route table is deliberately isolated in `src/app/page.tsx`
(`APP_ROUTES`). To move to App Router routes or React Router in your own
repository:

1. Copy each feature screen from `src/features/` unchanged — screens import
   the store and API client, never the router.
2. Create a route file per entry in the table above, or mount React Router's
   `<HashRouter>`/`<BrowserRouter>` with the same `APP_ROUTES` table.
3. Replace `Link`/`useRouter` imports with the router of your choice — the
   component API (`to`, navigation calls) was kept intentionally compatible.

## First-run behavior

- `moss.onboarded` in `localStorage` tracks whether setup completed.
- First visit to any `#/app…` route without onboarding redirects to
  `#/app/onboarding`.
- The setup flow can be skipped at every step ("Skip — explore the demo
  workspace"), and can be re-run from Settings → Workspace → "Re-run setup
  guide".

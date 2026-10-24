# Moss — Work Log

---
Task ID: 1
Agent: main (Z.ai)
Task: Build the complete Moss frontend — premium landing page + full application dashboard (Type 3, interactive web development).

Work Log:
- Initialized fullstack environment; inspected scaffold (Next.js 16 App Router, Tailwind 4, shadcn/ui, Zustand, Lucide).
- Adapted requested stack: Next.js 16 instead of Vite (environment-mandated); typed hash router at `/` because the sandbox exposes only the root route (React Router-compatible route table, documented migration path).
- Design system: rewrote `src/app/globals.css` with the Moss palette (forest/moss/sage/mint/ivory + semantic tokens), botanical utilities, reduced-motion support, dark "Night garden" theme; new logo SVGs (`public/moss-icon.svg`, `public/moss-logo.svg`); metadata + favicon in `layout.tsx`.
- Domain layer: `src/types/domain.ts` (full API contract types), `src/lib/format.ts`, `src/config/site.ts` (repo/docs/license URLs null until configured — no invented claims).
- Mock backend: `src/mocks/seed.ts` (18 interlinked files, 4 collections, 6 tasks, 4 duplicate groups, 8 recommendations incl. one failed-with-conflict, activity history); `src/lib/api/mock.ts` (staged simulated analysis pipeline, conflict + undo semantics, honest runtime status); `src/lib/api/http.ts` (FastAPI provider, timeout handling); `src/lib/api/client.ts` (provider selection via `NEXT_PUBLIC_MOSS_API_URL`).
- State: `src/store/workspace.ts` — Zustand store with bootstrap, scan polling loop, approval/rejection/undo, double-submission guards, settings persistence.
- Landing: nav + hero with component-built MiniWorkspace preview (labelled "Sample preview"), Problem, Introducing (comparison table), 7 Features, How It Works (4 steps), tabbed Product Showcase, Why Local AI (incl. open-weight vs open-source explainer), Trust & Safety, Open Source, Final CTA, Footer.
- Workspace: app shell (sidebar, mobile sheet nav, AI status chips, theme toggle), first-run onboarding (validation/retry/skip per step), Overview, Inbox + file-detail drawer (deep-linkable), analysis dialog, Collections (confirm/dismiss), Action Items (verify/dismiss/done, certainty badges), Duplicates (exact/near/semantic tabs), Review Queue (edit with validation, approve w/ confirm dialog, reject, conflict display), Activity (undo w/ confirm), Settings (workspace, formats, runtime test, privacy, appearance).
- Root wiring: error boundary, splash, route table, 404, onboarding redirect, page titles.
- Verification: `bunx tsc --noEmit` clean (app code), `bun run lint` clean, Agent Browser E2E: landing render → onboarding (validation + runtime check + first scan) → analysis stages → review approval → undo → collections confirm → action verify → duplicates tabs → inbox search/filter/drawer deep link → theme toggle → back/forward → 404 → mobile nav. Fixed two bugs found in verification (stage total counters; duplicate identifier).
- Docs: `README.md`, `docs/API_CONTRACT.md`, `docs/ROUTING.md`.

Stage Summary:
- Deliverable: runnable premium frontend at `/` (landing) and `#/app/*` (dashboard), demo mode default, live FastAPI switch via env var.
- Key decisions: hash router for single-route sandbox; honesty rules (Demo data badge, no fabricated metrics, uncertainty labels) encoded in store/mock/UI.
- Remaining: `next build` not runnable in sandbox; Vitest/Playwright scaffolding intentionally omitted (documented in README); backend endpoints to be implemented per contract doc.

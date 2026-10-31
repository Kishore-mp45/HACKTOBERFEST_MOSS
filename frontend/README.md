# Moss — The Digital Backlog Gardener

*Let your digital garden grow. Moss will handle the clutter.*

Moss is a local-first, open-source AI application that understands an
authorized collection of documents, connects related information, discovers
forgotten tasks and deadlines, recommends meaningful organization — and
executes file operations only after explicit human approval.

This repository contains the complete frontend: a premium public landing page
and a fully interactive workspace dashboard, sharing one design system
(**The Digital Garden Workspace**) and one typed API boundary.

---

## Quick start

```bash
npm install
npm run dev        # Next.js development server on http://localhost:3000
npm run lint
npm run typecheck
npm run build
```

Open `http://localhost:3000`:

- `/` — the public landing page.
- Click **Open Workspace** — first-run onboarding starts (each step is
  skippable), then the Overview dashboard connected to the local backend.

## Modes: demo vs live backend

| Mode | When | What you get |
|------|------|--------------|
| **Live (default)** | `NEXT_PUBLIC_MOSS_API_URL` unset | `HttpMossApi` connects to `http://127.0.0.1:8765`. |
| **Live (custom backend)** | `NEXT_PUBLIC_MOSS_API_URL=http://127.0.0.1:8765` | `HttpMossApi` calls the configured FastAPI endpoints through `/api`. |
| **Development demo** | `NEXT_PUBLIC_MOSS_DEMO_MODE=true` and no API URL, development only | `MockMossApi` serves labelled synthetic fixtures from `src/mocks/`. This mode is disabled in production builds. |

The centralized client lives in `src/lib/api/client.ts`. Feature code never
calls `fetch` directly and never imports from `src/mocks/`.

## Routes

Both experiences share the brand but have distinct information architecture.
This deployment uses a typed hash router (the sandbox exposes only `/`);
see [`docs/ROUTING.md`](docs/ROUTING.md) for the full table and the
1:1 migration path to filesystem routes / React Router in a self-hosted repo.

- **Landing** (`#/`): Hero + product preview · Problem · Introducing Moss ·
  Features · How It Works · Product Showcase · Why Local AI Matters ·
  Trust & Safety · Open Source · Final CTA · Footer.
- **Workspace** (`#/app/…`): Overview · Inbox (+ file detail drawer with
  evidence) · Collections · Action Items · Duplicates · Review Queue ·
  Activity (undo) · Settings · Onboarding · 404.

## Project structure

```
src/
├── app/                    # Next.js App Router entry (layout, page, tokens)
├── components/
│   ├── moss/               # Moss primitives: logo, badges, file glyphs, cards
│   └── ui/                 # shadcn/ui component set
├── config/site.ts          # Repository/docs/license URLs — null until configured
├── features/
│   ├── landing/            # Nav, hero, sections, showcase, footer
│   └── workspace/          # App shell, onboarding, all dashboard screens
├── hooks/                  # Page titles, debounce, theme
├── lib/
│   ├── api/                # client.ts (selection) · http.ts (FastAPI) · mock.ts
│   ├── router.tsx          # Typed hash router
│   └── format.ts           # Bytes, dates, due-date honesty formatting
├── mocks/seed.ts           # Synthetic fixtures (demo only, clearly labelled)
├── store/workspace.ts      # Zustand store: data + all interaction actions
└── types/domain.ts         # API contract types (source of truth)
```

## Product principles enforced in code

- **Nothing changes without approval** — every consequential operation goes
  through the Review Queue with a preview + confirmation dialog.
- **Evidence-backed** — tasks, relationships, and recommendations carry
  source excerpts (with PDF page refs) rendered in the UI.
- **Honesty about uncertainty** — estimated dates are labelled "estimated";
  low confidence is shown; failed extractions and conflicts are surfaced, not
  hidden.
- **No silent deletion** — duplicates are review candidates only.
- **Verified runtime status only** — the UI reports what the backend confirms
  and never claims a model runs locally without that confirmation.
- **Undo only when reversible** — the Activity screen shows Undo only for
  operations the backend marks `undoable`.

## Configuration

| Variable | Effect |
|----------|--------|
| `NEXT_PUBLIC_MOSS_API_URL` | FastAPI origin; defaults to `http://127.0.0.1:8765`. |
| `NEXT_PUBLIC_MOSS_DEMO_MODE` | Set to `true` to explicitly enable synthetic data in development; ignored in production and whenever an API URL is set. |
| `NEXT_PUBLIC_MOSS_REPO_URL` | Enables GitHub CTAs in the nav, Community section, Final CTA, and footer. Never a placeholder. |

## Live integration status

The frontend talks to the FastAPI service running on port `8765`. The live
provider uses the workspace browser/configuration, verified Ollama model
status, dashboard/files/actions/duplicates/recommendation reads, scan jobs,
and scan SSE stream. The browser never reads or modifies workspace files.

Phase 9 review mutations, explicit approval, safe file execution, and undo are
implemented through the local backend. Execution is workspace-scoped and
requires a separate approval; destination conflicts receive a unique filename
rather than overwriting existing files. Undo reports conflicts when the
original path is occupied or the moved file is missing. Per-workspace
include/exclusion preferences remain unsupported. Supported backend parsers
are PDF, DOCX, Markdown, and plain text.

## Browser workflow test

`npm run test:e2e` runs the workspace setup → scan progress → file relationships
→ duplicate review → approve → execute → activity workflow in Chrome. The test
uses Playwright to stub the local HTTP API at the network boundary, so it never
contacts Ollama or reads/modifies real files. Install the Playwright package
through `npm install` and use a local Chrome installation.

## Known limitations (honest list)

- GitHub/documentation/license links stay hidden until real URLs are
  configured — the frontend does not invent them.

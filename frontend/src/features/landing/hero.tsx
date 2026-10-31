"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FolderTree,
  Gauge,
  Inbox,
  ListChecks,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTypeGlyph } from "@/components/moss/file-icon";
import { MossMark } from "@/components/moss/logo";
import { Link, useRouter } from "@/lib/router";
import { useSectionScroll } from "./nav";

/**
 * Hero product visualization — a miniature Moss dashboard built from the same
 * primitives as the real app. It uses illustrative data and is explicitly
 * labelled as a sample preview; it does not pretend to be a live analysis.
 */
function MiniWorkspace() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-botanical opacity-70"
      />
      <div className="overflow-hidden rounded-xl border border-moss-line bg-card shadow-[0_24px_60px_-24px_rgba(32,61,50,0.35)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b bg-moss-ivory px-4 py-2.5">
          <div className="flex items-center gap-2" aria-hidden>
            <span className="size-2.5 rounded-full bg-moss-error-fg/60" />
            <span className="size-2.5 rounded-full bg-moss-warn-fg/50" />
            <span className="size-2.5 rounded-full bg-moss-ok-fg/60" />
          </div>
          <p className="truncate font-mono text-[0.68rem] text-muted-foreground">Moss — Garden workspace</p>
          <span className="rounded-full border border-moss-line bg-card px-2 py-0.5 text-[0.62rem] font-medium text-moss-ash">
            Sample preview
          </span>
        </div>

        <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr]">
          {/* Mini sidebar */}
          <div className="border-r bg-moss-ivory/60 p-3">
            <div className="mb-3 flex items-center gap-1.5">
              <MossMark size={20} />
              <span className="hidden text-xs font-semibold sm:inline">Moss</span>
            </div>
            {[
              { icon: Gauge, label: "Overview", active: true },
              { icon: Inbox, label: "Inbox" },
              { icon: FolderTree, label: "Collections" },
              { icon: ListChecks, label: "Tasks" },
            ].map((item) => (
              <div
                key={item.label}
                className={`mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.7rem] ${
                  item.active ? "bg-moss-forest font-medium text-moss-ivory" : "text-moss-ash"
                }`}
              >
                <item.icon className="size-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Mini content */}
          <div className="space-y-3 p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Workspace · Garden</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-moss-mint px-2 py-0.5 text-[0.62rem] font-medium text-moss-forest">
                <Sparkles className="size-3" aria-hidden />
                AI suggestions
              </span>
            </div>

            {/* Rename suggestion */}
            <div className="rounded-lg border border-moss-line bg-moss-ivory/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.68rem] font-semibold text-foreground">Suggested rename</p>
                <span className="rounded bg-moss-ok-bg px-1.5 py-0.5 text-[0.6rem] font-medium text-moss-ok-fg">Review</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <FileTypeGlyph kind="xlsx" size="sm" />
                <span className="truncate font-mono text-[0.66rem] text-muted-foreground line-through decoration-moss-sage">
                  q3-expense-report-DRAFT-final2.xlsx
                </span>
                <ArrowRight className="size-3 shrink-0 text-moss-moss" aria-hidden />
                <span className="truncate font-mono text-[0.66rem] font-medium text-moss-forest">
                  acme-q3-2026-expense-report.xlsx
                </span>
              </div>
            </div>

            {/* Related group */}
            <div className="rounded-lg border border-moss-line bg-moss-ivory/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.68rem] font-semibold text-foreground">Related documents · Thesis thread</p>
                <span className="rounded bg-moss-ok-bg px-1.5 py-0.5 text-[0.6rem] font-medium text-moss-ok-fg">Review group</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {[
                  { name: "climate-paper-v3.pdf", kind: "pdf" as const, sim: "0.86" },
                  { name: "thesis-ch3-urban-heat-draft.docx", kind: "docx" as const, sim: "0.83" },
                  { name: "thesis-notes-ideas.md", kind: "md" as const, sim: "0.74" },
                ].map((f) => (
                  <li key={f.name} className="flex items-center gap-1.5">
                    <FileTypeGlyph kind={f.kind} size="sm" />
                    <span className="truncate text-[0.66rem] text-foreground">{f.name}</span>
                    <span className="ml-auto shrink-0 rounded bg-moss-info-bg px-1 font-mono text-[0.58rem] text-moss-info-fg">
                      {f.sim}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Extracted task + duplicate */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-moss-line bg-moss-ivory/50 p-2.5">
                <p className="text-[0.68rem] font-semibold text-foreground">Extracted task</p>
                <p className="mt-1 line-clamp-2 text-[0.66rem] leading-relaxed text-muted-foreground">
                  “Send the revised Q3 budget to Anja”
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="rounded bg-moss-warn-bg px-1.5 py-0.5 text-[0.58rem] font-medium text-moss-warn-fg">
                    Due in 3 days
                  </span>
                  <span className="text-[0.6rem] font-medium text-moss-moss">Verify</span>
                </div>
              </div>
              <div className="rounded-lg border border-moss-line bg-moss-ivory/50 p-2.5">
                <p className="text-[0.68rem] font-semibold text-foreground">Duplicate candidate</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Copy className="size-3 text-moss-sage" aria-hidden />
                  <span className="truncate text-[0.66rem] text-muted-foreground">climate-paper-v3 (1).pdf</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="rounded bg-moss-info-bg px-1.5 py-0.5 text-[0.58rem] font-medium text-moss-info-fg">
                    SHA-256 identical
                  </span>
                  <span className="text-[0.6rem] font-medium text-moss-moss">Compare</span>
                </div>
              </div>
            </div>

            <p className="flex items-center gap-1.5 rounded-md bg-moss-forest px-2.5 py-2 text-[0.64rem] font-medium text-moss-ivory">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              Nothing changes until you approve it — every action is reviewable and reversible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const scroll = useSectionScroll();
  const { navigate } = useRouter();

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 h-72 bg-botanical opacity-40" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-moss-line bg-card px-3 py-1 text-xs font-medium text-moss-ash">
            <span className="size-1.5 rounded-full bg-moss-moss" aria-hidden />
            Local-first AI · Open-weight models · Human-approved changes
          </p>
          <h1
            id="hero-heading"
            className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl"
          >
            Your digital clutter.{" "}
            <span className="text-moss-forest">Finally, under control.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Moss uses local AI to understand your files, connect scattered information, surface forgotten
            tasks, and organize your digital workspace — with you in control.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-lg px-6">
              <Link to="/app">
                Explore Your Workspace
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-lg border-moss-line bg-card px-6 hover:bg-moss-mint/50"
              onClick={() => scroll("how-it-works")}
            >
              See How Moss Works
            </Button>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-moss-moss" aria-hidden /> Processes only your authorized workspace
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-moss-moss" aria-hidden /> You approve every change
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-moss-moss" aria-hidden /> Open source by design
            </span>
          </p>
        </div>

        <div>
          <MiniWorkspace />
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            Sample preview with illustrative data — after setup, Moss analyzes your own authorized
            workspace and every suggestion links back to its source.
          </p>
        </div>
      </div>
    </section>
  );
}

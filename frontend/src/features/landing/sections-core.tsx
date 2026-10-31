"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Copy,
  FileSearch,
  FolderOpen,
  FolderSync,
  Hand,
  Layers,
  Link2,
  ListChecks,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

/* ------------------------------ shared ---------------------------- */

export function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-20 py-20 sm:py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss-moss">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {lead ? <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/* ------------------------------ Problem --------------------------- */

const PROBLEMS = [
  {
    icon: Search,
    title: "Information vanishes",
    body: "The answer you remember writing is buried in a PDF you downloaded months ago. Filename search never finds it.",
  },
  {
    icon: FolderSync,
    title: "Related files scatter",
    body: "The contract lands in one folder, its invoice in another, the notes in a third. The thread only exists in your head.",
  },
  {
    icon: Copy,
    title: "Duplicates pile up",
    body: "Every re-download and manual copy quietly doubles your storage — and your doubt about which file is current.",
  },
  {
    icon: ListChecks,
    title: "Tasks stay buried",
    body: "Deadlines and to-dos hide inside documents you never open again. They resurface only when it is already late.",
  },
  {
    icon: FolderOpen,
    title: "Organization eats time",
    body: "Renaming, sorting, and filing by hand is a chore you postpone — so the backlog grows instead of shrinking.",
  },
] as const;

export function Problem() {
  return (
    <Section id="problem" className="bg-card" labelledBy="problem-heading">
      <SectionHeading
        id="problem-heading"
        eyebrow="The familiar backlog"
        title="Your files didn't get messy. They just got human."
        lead="PDFs, notes, reports, scans, downloads. Each one made sense the day you saved it — together they became a backlog no file manager can explain."
      />
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map((problem, index) => (
          <li
            key={problem.title}
            className={cn(
              "rounded-xl border border-moss-line bg-background p-6 transition-colors hover:border-moss-sage/80",
              index === 4 && "sm:col-span-2 lg:col-span-1",
            )}
          >
            <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-moss-mint text-moss-forest">
              <problem.icon className="size-5" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{problem.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{problem.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-center text-sm italic text-muted-foreground">
        Sound familiar? This is exactly the backlog Moss was built to tend.
      </p>
    </Section>
  );
}

/* --------------------------- Introducing -------------------------- */

const COMPARE_ROWS: { traditional: string; moss: string }[] = [
  { traditional: "Searches filenames and folder names", moss: "Reads document content, topics, and context" },
  { traditional: "You decide where every file belongs", moss: "Proposes groupings with the evidence behind them" },
  { traditional: "Duplicates are your problem to hunt down", moss: "Flags exact and near-duplicates for your review" },
  { traditional: "Deadlines live and die inside the document", moss: "Surfaces action items with links to the source line" },
  { traditional: "One wrong drag-and-drop is hard to undo", moss: "Every approved change is logged and reversible" },
];

export function Introducing() {
  return (
    <Section id="introducing" labelledBy="introducing-heading">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <SectionHeading
            id="introducing-heading"
            align="left"
            eyebrow="Meet Moss"
            title="File management that reads first and asks second"
            lead="Moss is not another renamer. It interprets what your documents actually say, connects related material across folders, discovers the useful information hiding inside them — and then proposes what to do, one reviewable step at a time."
          />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Traditional tools are not the enemy — they are just blind to meaning. Moss complements them:
            it works from the inside of your documents out, and it never moves a byte without your sign-off.
          </p>
          <Button asChild className="mt-8 rounded-lg">
            <Link to="/app">
              Try the workspace
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-moss-line bg-card shadow-[0_20px_50px_-28px_rgba(32,61,50,0.3)]">
          <div className="grid grid-cols-2 border-b border-moss-line bg-moss-ivory text-xs font-semibold uppercase tracking-wide">
            <div className="px-5 py-3 text-muted-foreground">Traditional file management</div>
            <div className="border-l border-moss-line bg-moss-mint/60 px-5 py-3 text-moss-forest">With Moss</div>
          </div>
          <ul>
            {COMPARE_ROWS.map((row, index) => (
              <li
                key={row.traditional}
                className={cn("grid grid-cols-2 text-sm", index !== COMPARE_ROWS.length - 1 && "border-b border-moss-line/70")}
              >
                <div className="px-5 py-3.5 leading-relaxed text-muted-foreground">{row.traditional}</div>
                <div className="border-l border-moss-line/70 bg-moss-mint/20 px-5 py-3.5 leading-relaxed text-foreground">
                  <span className="mr-1.5 inline-block size-1.5 rounded-full bg-moss-moss align-middle" aria-hidden />
                  {row.moss}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------- Features --------------------------- */

const FEATURES = [
  {
    icon: BookOpenCheck,
    name: "Intelligent document understanding",
    body: "Moss analyzes supported documents to understand their purpose, topic, and keywords — the meaning, not just the metadata.",
    tag: "Understand",
  },
  {
    icon: Layers,
    name: "Semantic file organization",
    body: "Related files are grouped by what they are about, not by which folder they happened to land in. Threads become visible again.",
    tag: "Connect",
  },
  {
    icon: Copy,
    name: "Duplicate discovery",
    body: "Exact duplicates are detected by hash; likely near-duplicates are surfaced for review. Nothing is ever deleted automatically.",
    tag: "Compare",
  },
  {
    icon: ListChecks,
    name: "Forgotten task discovery",
    body: "Action items, deadlines, and follow-ups hiding in your documents are extracted — each one linked to the passage it came from.",
    tag: "Surface",
  },
  {
    icon: Wand2,
    name: "Context-aware recommendations",
    body: "Meaningful filenames, sensible destinations, archive candidates. Every proposal explains its reasoning and shows its evidence.",
    tag: "Propose",
  },
  {
    icon: Hand,
    name: "Safe automation",
    body: "Review, approve, reject, or edit each suggestion. Approved operations are logged, and reversible ones can be undone from Activity.",
    tag: "Approve",
  },
] as const;

export function Features() {
  return (
    <Section id="features" className="bg-card" labelledBy="features-heading">
      <SectionHeading
        id="features-heading"
        eyebrow="Core features"
        title="A gardener for your documents, not another autopilot"
        lead="Seven capabilities that work as one loop: understand, connect, discover, propose — and always let you decide."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <article
            key={feature.name}
            className="group relative flex flex-col rounded-xl border border-moss-line bg-background p-6 transition-all hover:border-moss-sage/80 hover:shadow-[0_12px_32px_-20px_rgba(32,61,50,0.35)]"
          >
            <div className="flex items-start justify-between">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-moss-mint text-moss-forest transition-colors group-hover:bg-moss-forest group-hover:text-moss-ivory">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <span className="rounded-full border border-moss-line px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-moss-ash">
                {feature.tag}
              </span>
            </div>
            <h3 className="mt-5 text-base font-semibold text-foreground">{feature.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
          </article>
        ))}

        {/* Local AI feature — split panel to break the card grid rhythm */}
        <article className="relative overflow-hidden rounded-xl border border-moss-forest/20 bg-moss-forest p-6 text-moss-ivory sm:col-span-2 lg:col-span-1">
          <div aria-hidden className="absolute -right-8 -top-8 size-28 rounded-full bg-moss-moss/25 blur-2xl" />
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 text-moss-ivory">
            <Lock className="size-5" aria-hidden />
          </span>
          <h3 className="mt-5 text-base font-semibold">Local AI and privacy</h3>
          <p className="mt-2 text-sm leading-relaxed text-moss-ivory/85">
            Open-weight models and local inference keep document understanding on your machine where your
            runtime supports it — reducing dependence on external AI services and their recurring costs.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-moss-sage">
            <Sparkles className="size-3.5" aria-hidden />
            Model choice stays yours — swap models any time.
          </p>
        </article>
      </div>
    </Section>
  );
}

/* ---------------------------- How it works ------------------------ */

const STEPS = [
  {
    icon: FolderOpen,
    step: "01",
    title: "Bring your files",
    body: "Choose one authorized local workspace. Moss only ever reads the folder you explicitly grant — nothing outside it.",
  },
  {
    icon: FileSearch,
    step: "02",
    title: "Let Moss understand",
    body: "Local AI reads the content, classifies each document, and identifies potentially related material across the workspace.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "Discover what matters",
    body: "Review related-document groups, duplicate candidates, forgotten tasks, deadlines, and proposed improvements — all with evidence.",
  },
  {
    icon: Tag,
    step: "04",
    title: "Review and organize",
    body: "Approve the suggestions you agree with, apply supported operations, and audit everything later in the activity history.",
  },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="hiw-heading">
      <SectionHeading
        id="hiw-heading"
        eyebrow="How Moss works"
        title="Four steps. One of them is yours."
        lead="Analysis runs automatically; every consequential change waits for explicit approval. That boundary is the product."
      />
      <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.step} className="relative">
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-full top-8 hidden h-px w-5 -translate-y-1/2 bg-moss-sage/70 lg:block"
              />
            ) : null}
            <div className="h-full rounded-xl border border-moss-line bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-moss-mint text-moss-forest">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="font-mono text-xs font-semibold text-moss-sage">{step.step}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mx-auto mt-10 flex max-w-xl items-start gap-2.5 rounded-lg border border-moss-line bg-moss-mint/40 px-4 py-3 text-sm leading-relaxed text-moss-forest">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Steps 1–3 only read and analyze. Step 4 is the only place where files are touched — and only the
          operations you approved, each with a preview of exactly what will happen.
        </span>
      </p>
    </Section>
  );
}

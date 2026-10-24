"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  CircleHelp,
  Cpu,
  Eye,
  FileWarning,
  Github,
  Hand,
  History,
  Laptop,
  Leaf,
  Lock,
  Plug,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MossLogo } from "@/components/moss/logo";
import { siteConfig } from "@/config/site";
import { Link } from "@/lib/router";
import { Section, SectionHeading } from "./sections-core";
import { SectionScrollLink } from "./nav";

/* --------------------------- Why local AI ------------------------- */

const LOCAL_POINTS = [
  {
    icon: Laptop,
    title: "Processing where you run it",
    body: "When your configuration points Moss at a local runtime, document analysis happens on your machine — not on someone else's queue.",
  },
  {
    icon: Plug,
    title: "Less reliance on external APIs",
    body: "Open-weight models mean your documents don't have to leave for a hosted service to be understood.",
  },
  {
    icon: SlidersHorizontal,
    title: "Your model, your rules",
    body: "Swap, tune, or pin the model in your setup. Moss is built to be model-replaceable, not welded to one vendor.",
  },
  {
    icon: Cpu,
    title: "Customizable behavior",
    body: "Prompts, categories, and workflows are open to inspection and community modification.",
  },
  {
    icon: Wallet,
    title: "Potentially lower costs",
    body: "Local inference can reduce recurring API costs — subject to your hardware and the model you choose. We won't pretend compute is free.",
  },
  {
    icon: WifiOff,
    title: "Offline-friendly architecture",
    body: "Once the required dependencies and models are installed, the configured pipeline can keep working without connectivity — depending on your setup.",
  },
] as const;

export function LocalAI() {
  return (
    <Section id="privacy" labelledBy="local-heading">
      <SectionHeading
        id="local-heading"
        eyebrow="Privacy & local AI"
        title="Your documents say a lot. They should stay yours."
        lead="Moss is designed around open-weight models and local inference — with honest boundaries, not marketing promises."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LOCAL_POINTS.map((point) => (
          <div key={point.title} className="rounded-xl border border-moss-line bg-card p-6">
            <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-moss-mint text-moss-forest">
              <point.icon className="size-5" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-moss-line bg-moss-ivory/70 p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CircleHelp className="size-4 text-moss-moss" aria-hidden />
          “Open weights” and “open source” — what's the difference?
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Open-source software</strong> ships its full source
          code under a license that lets you run, study, modify, and share it.{" "}
          <strong className="font-medium text-foreground">Open-weight models</strong> publish trained model
          parameters — but not necessarily their training data, training code, or under a fully open license.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Moss treats these as two separate, deliberate choices: the application is developed in the open,
          and the AI layer is designed for open-weight models you can inspect and replace. Local inference
          reduces exposure — but it is a property of your configuration, not an automatic guarantee of
          privacy, and it still costs compute.
        </p>
      </div>
    </Section>
  );
}

/* ----------------------------- Trust ------------------------------ */

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "A bounded workspace",
    body: "Processing is restricted to the one workspace you authorized. The browser frontend never gets raw filesystem access — the backend enforces the boundary.",
  },
  {
    icon: Eye,
    title: "Proposals before changes",
    body: "Every rename, move, or archive appears in the review queue first, with the current state, the proposed state, and the reasoning side by side.",
  },
  {
    icon: ScrollText,
    title: "Evidence you can open",
    body: "Suggestions link back to source excerpts — including page numbers for PDFs — so you can verify before trusting.",
  },
  {
    icon: FileWarning,
    title: "Uncertainty is labelled",
    body: "An estimated deadline says 'estimated'. A low-confidence extraction shows it. Moss flags doubt instead of hiding it.",
  },
  {
    icon: ShieldCheck,
    title: "No automatic deletion",
    body: "Duplicates are surfaced for comparison — never silently deleted or merged, even the exact ones.",
  },
  {
    icon: History,
    title: "History and undo",
    body: "Operations are recorded, and when the backend confirms reliable recovery, an Undo button appears. Partial failures are reported as partial.",
  },
] as const;

export function Trust() {
  return (
    <Section id="trust" className="bg-card" labelledBy="trust-heading">
      <SectionHeading
        id="trust-heading"
        eyebrow="Trust & safety"
        title="Human approval is the product principle"
        lead="Moss is designed to earn trust with visible behavior — bounded access, explainable suggestions, and a trail you can audit."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST_POINTS.map((point) => (
          <div key={point.title} className="rounded-xl border border-moss-line bg-background p-6">
            <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-moss-mint text-moss-forest">
              <point.icon className="size-5" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-2xl items-center justify-center gap-3 rounded-xl bg-moss-forest px-6 py-5 text-center">
        <Hand className="size-5 shrink-0 text-moss-sage" aria-hidden />
        <p className="text-sm font-medium leading-relaxed text-moss-ivory">
          The rule the whole product hangs on: nothing in your workspace changes until a human — you — says so.
        </p>
      </div>
    </Section>
  );
}

/* ---------------------------- Community --------------------------- */

export function Community() {
  return (
    <Section id="open-source" labelledBy="community-heading">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <SectionHeading
            id="community-heading"
            align="left"
            eyebrow="Open source"
            title="Grow Moss with the community"
            lead="Moss is built to be adapted: replace the model, add a file format, adjust the recommendation prompts, or wire it into your own tooling. The codebase is the documentation's first citizen — and contributions are the point."
          />
          <ul className="mt-8 space-y-4">
            {[
              { icon: Boxes, text: "Model replaceability — bring the open-weight model that fits your hardware and language." },
              { icon: BookOpen, text: "Setup and integration guides live with the code, so self-hosting is a documented path, not folklore." },
              { icon: Users, text: "Contribution-friendly: typed API contracts, isolated demo fixtures, and a small, readable core." },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-moss-mint text-moss-forest">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            {siteConfig.repositoryUrl ? (
              <Button asChild variant="outline" className="rounded-lg border-moss-line bg-card">
                <a href={siteConfig.repositoryUrl} target="_blank" rel="noreferrer noopener">
                  <Github className="mr-1.5 size-4" aria-hidden />
                  Visit the repository
                </a>
              </Button>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-lg border border-dashed border-moss-line bg-moss-ivory/60 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <Github className="size-4 shrink-0" aria-hidden />
                The repository link appears here once it is configured for this deployment
                (<code className="font-mono text-[0.68rem]">NEXT_PUBLIC_MOSS_REPO_URL</code>).
              </p>
            )}
            {siteConfig.documentationUrl ? (
              <Button asChild variant="ghost" className="rounded-lg text-moss-forest hover:bg-moss-mint/60">
                <a href={siteConfig.documentationUrl}>Read the documentation</a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative">
          <div aria-hidden className="absolute -inset-8 -z-10 rounded-[2rem] bg-botanical opacity-50" />
          <div className="rounded-xl border border-moss-line bg-card p-7 shadow-[0_20px_50px_-30px_rgba(32,61,50,0.3)]">
            <Leaf className="size-6 text-moss-moss" aria-hidden />
            <p className="mt-4 font-serif text-xl leading-relaxed text-foreground">
              “A digital garden is never finished — it is tended.”
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Moss is maintained in the open. Its roadmap, issues, and design decisions are discussed in
              public, and the demo workspace you just toured ships in the repository so every contributor
              tests against the same data.
            </p>
            <Button asChild className="mt-6 rounded-lg">
              <Link to="/app">
                Explore the demo workspace
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------- Final CTA -------------------------- */

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-heading" className="scroll-mt-20 pb-20 pt-4 sm:pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="bg-forest-panel relative overflow-hidden rounded-2xl px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="absolute inset-0 bg-botanical opacity-[0.08]" />
          <h2 id="final-cta-heading" className="relative text-balance text-3xl font-semibold tracking-tight text-moss-ivory sm:text-4xl">
            A little less clutter. A lot more clarity.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-moss-ivory/80">
            Give your digital workspace the attention it deserves — without spending your day organizing it.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-lg bg-moss-ivory px-6 text-moss-forest hover:bg-white">
              <Link to="/app">
                Open Moss
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
            {siteConfig.repositoryUrl ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-lg border-moss-ivory/40 bg-transparent px-6 text-moss-ivory hover:bg-white/10 hover:text-moss-ivory"
              >
                <a href={siteConfig.repositoryUrl} target="_blank" rel="noreferrer noopener">
                  <Github className="mr-1.5 size-4" aria-hidden />
                  Explore the Source
                </a>
              </Button>
            ) : null}
          </div>
          <p className="relative mt-6 text-xs leading-relaxed text-moss-ivory/70">
            Local-first AI · You approve every change · Open source by design
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Footer ---------------------------- */

export function LandingFooter() {
  return (
    <footer className="border-t border-moss-line bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <MossLogo size={30} tagline />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            A local-first AI agent that understands your documents, connects the dots, and tends the backlog —
            with you approving every change.
          </p>
        </div>
        <nav aria-label="Product">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><SectionScrollLink sectionId="features" className="hover:text-moss-forest">Features</SectionScrollLink></li>
            <li><SectionScrollLink sectionId="how-it-works" className="hover:text-moss-forest">How It Works</SectionScrollLink></li>
            <li><SectionScrollLink sectionId="privacy" className="hover:text-moss-forest">Privacy</SectionScrollLink></li>
            <li>
              <Link to="/app" className="rounded-sm text-muted-foreground transition-colors hover:text-foreground">
                Open Workspace
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Project">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Project</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><SectionScrollLink sectionId="open-source" className="hover:text-moss-forest">Open Source</SectionScrollLink></li>
            {siteConfig.repositoryUrl ? (
              <li>
                <a
                  href={siteConfig.repositoryUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Github className="size-3.5" aria-hidden />
                  GitHub
                </a>
              </li>
            ) : null}
            {siteConfig.documentationUrl ? (
              <li>
                <a href={siteConfig.documentationUrl} className="rounded-sm text-muted-foreground transition-colors hover:text-foreground">
                  Documentation
                </a>
              </li>
            ) : null}
            {siteConfig.license ? <li className="text-muted-foreground">License: {siteConfig.license}</li> : null}
          </ul>
        </nav>
      </div>
      <div className="border-t border-moss-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{siteConfig.copyright}. Moss is an open-source project — build it, host it, tend it.</p>
          <p>This deployment presents illustrative demo data for evaluation.</p>
        </div>
      </div>
    </footer>
  );
}

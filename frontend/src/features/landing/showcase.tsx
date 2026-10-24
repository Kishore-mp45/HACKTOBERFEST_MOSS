"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FolderTree,
  Gauge,
  ListChecks,
  SplitSquareVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileTypeGlyph } from "@/components/moss/file-icon";
import { ActionStatusBadge, AnalysisStatusBadge, CertaintyBadge, DemoDataBadge, OriginBadge } from "@/components/moss/badges";
import { Section, SectionHeading } from "./sections-core";
import { Link } from "@/lib/router";
import {
  seedActionItems,
  seedCollections,
  seedDuplicates,
  seedFiles,
  seedRecommendations,
} from "@/mocks/seed";

/**
 * Product showcase — small, faithful previews of the actual dashboard,
 * assembled from the same primitives and demo fixtures. Buttons inside
 * previews navigate to the corresponding live screen (no inert controls).
 */

const file = (id: string) => seedFiles.find((f) => f.id === id)!;

function PreviewFrame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-moss-line bg-card shadow-[0_24px_60px_-30px_rgba(32,61,50,0.35)]">
      <div className="flex items-center justify-between border-b bg-moss-ivory px-4 py-2.5">
        <p className="font-mono text-[0.68rem] text-muted-foreground">Moss — {title}</p>
        <DemoDataBadge />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function OverviewPreview() {
  return (
    <PreviewFrame title="Overview">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Files analyzed", value: "15" },
          { label: "Semantic groups", value: "4" },
          { label: "Duplicate candidates", value: "4" },
          { label: "Awaiting review", value: "6" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-moss-line bg-moss-ivory/40 p-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-moss-line p-3">
        <p className="text-xs font-semibold text-foreground">Needs your attention</p>
        <ul className="mt-2 space-y-1.5">
          {[
            { name: "scan_2026-03-14_1132.pdf", note: "Text extraction failed — enable OCR", tone: "text-moss-error-fg" },
            { name: "annual-report-2024-final (copy).pdf", note: "Exact duplicate — review", tone: "text-moss-warn-fg" },
          ].map((row) => (
            <li key={row.name} className="flex items-center gap-2 text-xs">
              <span className={`size-1.5 shrink-0 rounded-full bg-current ${row.tone}`} aria-hidden />
              <span className="truncate font-medium text-foreground">{row.name}</span>
              <span className="ml-auto hidden shrink-0 text-muted-foreground sm:inline">{row.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </PreviewFrame>
  );
}

function CollectionsPreview() {
  const [first, second] = seedCollections;
  return (
    <PreviewFrame title="Collections">
      <div className="grid gap-3 sm:grid-cols-2">
        {[first, second].map((collection) => (
          <div key={collection.id} className="rounded-lg border border-moss-line p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{collection.name}</p>
              <OriginBadge origin={collection.origin} />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{collection.description}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {collection.fileIds.slice(0, 3).map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded border border-moss-line bg-moss-ivory/60 px-1.5 py-0.5 text-[0.62rem] text-muted-foreground">
                  <FileTypeGlyph kind={file(id).kind} size="sm" />
                  <span className="max-w-[9rem] truncate">{file(id).name}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function ActionItemsPreview() {
  return (
    <PreviewFrame title="Action items">
      <ul className="divide-y divide-moss-line/70">
        {seedActionItems.slice(0, 3).map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <FileTypeGlyph kind={file(item.sourceFileId).kind} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground">from {item.evidence.fileName}</p>
            </div>
            <CertaintyBadge certainty={item.dateCertainty} />
            <ActionStatusBadge status={item.status} />
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

function DuplicatesPreview() {
  const group = seedDuplicates[0];
  return (
    <PreviewFrame title="Duplicates">
      <div className="rounded-lg border border-moss-line p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-moss-error-bg px-2 py-0.5 text-xs font-medium text-moss-error-fg">
            <Copy className="size-3" aria-hidden />
            Exact · {group.method}
          </span>
          <span className="text-xs text-muted-foreground">Both files stay until you decide</span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {group.fileIds.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded border border-moss-line bg-moss-ivory/50 px-2.5 py-2">
              <FileTypeGlyph kind={file(id).kind} size="sm" />
              <span className="truncate font-mono text-xs text-foreground">{file(id).path}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-moss-ok-fg">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Keep both · keep one · dismiss — you choose; Moss never deletes silently.
        </p>
      </div>
    </PreviewFrame>
  );
}

function ReviewQueuePreview() {
  const rec = seedRecommendations[0];
  return (
    <PreviewFrame title="Review queue">
      <div className="rounded-lg border border-moss-line p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-moss-info-bg px-2 py-0.5 text-xs font-medium text-moss-info-fg">Rename</span>
          <span className="rounded-full bg-moss-ok-bg px-2 py-0.5 text-xs font-medium text-moss-ok-fg">Low risk</span>
          <span className="text-xs text-muted-foreground">88% confidence</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="truncate rounded bg-muted px-2 py-1 text-muted-foreground line-through">{rec.current}</span>
          <ArrowRight className="size-3.5 text-moss-moss" aria-hidden />
          <span className="truncate rounded bg-moss-mint px-2 py-1 font-medium text-moss-forest">{rec.proposed}</span>
        </div>
        <blockquote className="mt-3 border-l-2 border-moss-sage/70 pl-2.5 text-xs leading-relaxed text-muted-foreground">
          Evidence · “Acme GmbH — Expense Report, Q3 2026 (sheet ‘Header’, cell B2)”
        </blockquote>
      </div>
    </PreviewFrame>
  );
}

const TABS = [
  { id: "overview", label: "Overview", icon: Gauge, content: <OverviewPreview />, route: "/app" },
  { id: "collections", label: "Collections", icon: FolderTree, content: <CollectionsPreview />, route: "/app/collections" },
  { id: "actions", label: "Action items", icon: ListChecks, content: <ActionItemsPreview />, route: "/app/action-items" },
  { id: "duplicates", label: "Duplicates", icon: SplitSquareVertical, content: <DuplicatesPreview />, route: "/app/duplicates" },
  { id: "review", label: "Review queue", icon: CheckCircle2, content: <ReviewQueuePreview />, route: "/app/recommendations" },
] as const;

export function Showcase() {
  return (
    <Section id="showcase" className="bg-card" labelledBy="showcase-heading">
      <SectionHeading
        id="showcase-heading"
        eyebrow="Product tour"
        title="One workspace, five views"
        lead="Built from the same components as the running app. Open any view below to explore it with the demo workspace."
      />
      <Tabs defaultValue="overview" className="mt-12">
        <TabsList className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 bg-moss-mint/60 p-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-card data-[state=active]:text-moss-forest sm:text-sm"
            >
              <tab.icon className="size-3.5" aria-hidden />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            <div className="mx-auto max-w-3xl">
              {tab.content}
              <div className="mt-4 text-center">
                <Button asChild variant="ghost" size="sm" className="text-moss-forest hover:bg-moss-mint/60">
                  <Link to={tab.route}>
                    Open the live {tab.label.toLowerCase()} view
                    <ArrowRight className="ml-1 size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  );
}

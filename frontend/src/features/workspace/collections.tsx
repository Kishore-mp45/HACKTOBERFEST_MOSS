"use client";

import * as React from "react";
import { ChevronDown, FolderTree, FolderInput, Sprout, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState, EvidenceList, PageHeader } from "@/components/moss/primitives";
import { FileTypeGlyph } from "@/components/moss/file-icon";
import { OriginBadge } from "@/components/moss/badges";
import { useWorkspace } from "@/store/workspace";
import { Link, useRouter } from "@/lib/router";
import { usePageTitle } from "@/hooks/moss";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function CollectionsPage() {
  usePageTitle("Collections");
  const router = useRouter();
  const collections = useWorkspace((s) => s.collections);
  const files = useWorkspace((s) => s.files);
  const bootStatus = useWorkspace((s) => s.bootStatus);
  const confirmCollection = useWorkspace((s) => s.confirmCollection);
  const dismissCollection = useWorkspace((s) => s.dismissCollection);
  const busyIds = useWorkspace((s) => s.busyIds);

  const fileById = React.useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const suggested = collections.filter((c) => c.origin === "ai");
  const confirmed = collections.filter((c) => c.origin === "confirmed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Semantic groups Moss found across your workspace — based on what documents are about, not where they live. Confirm the ones you agree with."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-moss-info-bg px-2 py-0.5 font-medium text-moss-info-fg">{suggested.length} suggested</span>
            <span className="rounded-full bg-moss-ok-bg px-2 py-0.5 font-medium text-moss-ok-fg">{confirmed.length} confirmed</span>
          </div>
        }
      />

      {bootStatus === "loading" ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading collections…</p>
      ) : collections.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No collections yet"
          description="Run an analysis — Moss will propose groups of related documents here, each with the reasoning and evidence behind it."
          action={
            <Button asChild variant="outline" className="rounded-lg">
              <Link to="/app">Go to Overview</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {collections.map((collection) => (
            <article key={collection.id} className="flex flex-col rounded-xl border bg-card">
              <div className="border-b border-moss-line/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-foreground">{collection.name}</h2>
                  <OriginBadge origin={collection.origin} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{collection.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {collection.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-moss-mint px-2 py-0.5 text-[0.68rem] font-medium text-moss-forest">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {collection.fileIds.length} documents
                </p>
                <ul className="mt-2.5 space-y-1">
                  {collection.fileIds.map((fileId) => {
                    const file = fileById.get(fileId);
                    if (!file) return null;
                    return (
                      <li key={fileId}>
                        <button
                          type="button"
                          onClick={() => router.navigate(`/app/inbox?file=${file.id}`)}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-moss-line hover:bg-moss-mint/25 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        >
                          <FileTypeGlyph kind={file.kind} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
                            <span className="block truncate font-mono text-[0.66rem] text-muted-foreground">{file.path}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <Collapsible className="mt-4">
                  <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-moss-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    Why were these grouped? ({collection.evidence.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <EvidenceList evidence={collection.evidence} />
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {collection.origin === "ai" ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-moss-line/70 bg-moss-ivory/50 px-5 py-3.5">
                  <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sprout className="size-3.5 text-moss-moss" aria-hidden />
                    Confirming keeps this group across future scans.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    disabled={busyIds.includes(collection.id)}
                    onClick={async () => {
                      try {
                        await dismissCollection(collection.id);
                        toast({ title: "Suggestion dismissed", description: "Files were not touched." });
                      } catch (error) {
                        toast({
                          title: "Could not dismiss the suggestion",
                          description: error instanceof Error ? error.message : "The backend could not dismiss the collection.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-lg"
                    disabled={busyIds.includes(collection.id)}
                    onClick={async () => {
                      try {
                        await confirmCollection(collection.id);
                        toast({ title: "Collection confirmed", description: `${collection.name} is now user-confirmed.` });
                      } catch (error) {
                        toast({
                          title: "Could not confirm the collection",
                          description: error instanceof Error ? error.message : "The backend could not confirm the collection.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <FolderInput className="mr-1.5 size-3.5" aria-hidden />
                    Confirm group
                  </Button>
                </div>
              ) : (
                <div className={cn("border-t border-moss-line/70 bg-moss-ok-bg/30 px-5 py-3 text-xs text-moss-ok-fg")}>
                  You confirmed this grouping — Moss will keep it stable in future analyses.
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

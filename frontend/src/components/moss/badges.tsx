"use client";

import * as React from "react";
import { FlaskConical, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ActionItemStatus,
  AnalysisStatus,
  CollectionOrigin,
  DateCertainty,
  RecommendationStatus,
  RiskLevel,
} from "@/types/domain";

/** Shared chip shell — small, bordered, muted background. */
function Chip({
  className,
  children,
  dot = false,
  dotClass,
}: {
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
  dotClass?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap",
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dotClass)} /> : null}
      {children}
    </span>
  );
}

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  if (status === "analyzed") {
    return (
      <Chip className="border-transparent bg-moss-ok-bg text-moss-ok-fg" dot dotClass="bg-moss-moss">
        Analyzed
      </Chip>
    );
  }
  if (status === "pending") {
    return (
      <Chip className="border-transparent bg-moss-warn-bg text-moss-warn-fg" dot dotClass="bg-amber-500">
        Pending
      </Chip>
    );
  }
  return (
    <Chip className="border-transparent bg-moss-error-bg text-moss-error-fg" dot dotClass="bg-moss-error-fg">
      Error
    </Chip>
  );
}

export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <Chip className={cn("border-moss-line bg-card text-moss-ash", className)}>
      <FlaskConical className="size-3" aria-hidden />
      Demo data
    </Chip>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    low: "border-transparent bg-moss-ok-bg text-moss-ok-fg",
    medium: "border-transparent bg-moss-warn-bg text-moss-warn-fg",
    high: "border-transparent bg-moss-error-bg text-moss-error-fg",
    unknown: "border-border bg-muted text-muted-foreground",
  };
  const label = risk === "unknown" ? "Risk not assessed" : `${risk[0].toUpperCase()}${risk.slice(1)} risk`;
  return <Chip className={map[risk]}>{label}</Chip>;
}

export function RecommendationStatusBadge({ status }: { status: RecommendationStatus }) {
  const map: Record<RecommendationStatus, { label: string; className: string }> = {
    pending: { label: "Awaiting review", className: "border-transparent bg-moss-info-bg text-moss-info-fg" },
    approved: { label: "Approved", className: "border-transparent bg-moss-mint text-moss-forest" },
    applied: { label: "Applied", className: "border-transparent bg-moss-ok-bg text-moss-ok-fg" },
    rejected: { label: "Rejected", className: "border-border bg-muted text-muted-foreground" },
    dismissed: { label: "Dismissed", className: "border-border bg-muted text-muted-foreground" },
    failed: { label: "Failed", className: "border-transparent bg-moss-error-bg text-moss-error-fg" },
  };
  const entry = map[status];
  return <Chip className={entry.className}>{entry.label}</Chip>;
}

export function OriginBadge({ origin }: { origin: CollectionOrigin }) {
  return origin === "confirmed" ? (
    <Chip className="border-transparent bg-moss-ok-bg text-moss-ok-fg">
      <Sprout className="size-3" aria-hidden />
      Confirmed by you
    </Chip>
  ) : (
    <Chip className="border-transparent bg-moss-info-bg text-moss-info-fg">AI-suggested</Chip>
  );
}

export function CertaintyBadge({ certainty }: { certainty: DateCertainty }) {
  if (certainty === "explicit") {
    return <Chip className="border-transparent bg-moss-ok-bg text-moss-ok-fg">Explicit date</Chip>;
  }
  if (certainty === "inferred") {
    return <Chip className="border-transparent bg-moss-warn-bg text-moss-warn-fg">Estimated date</Chip>;
  }
  return <Chip className="border-border bg-muted text-muted-foreground">Uncertain</Chip>;
}

export function ActionStatusBadge({ status }: { status: ActionItemStatus }) {
  const map: Record<ActionItemStatus, { label: string; className: string }> = {
    new: { label: "New", className: "border-transparent bg-moss-info-bg text-moss-info-fg" },
    verified: { label: "Verified", className: "border-transparent bg-moss-ok-bg text-moss-ok-fg" },
    dismissed: { label: "Dismissed", className: "border-border bg-muted text-muted-foreground" },
    done: { label: "Done", className: "border-border bg-muted text-muted-foreground" },
  };
  const entry = map[status];
  return <Chip className={entry.className}>{entry.label}</Chip>;
}

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full",
            pct >= 80 ? "bg-moss-moss" : pct >= 60 ? "bg-moss-sage" : "bg-amber-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}% confidence</span>
    </span>
  );
}

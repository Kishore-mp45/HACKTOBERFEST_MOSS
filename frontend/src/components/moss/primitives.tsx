"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-moss-mint text-moss-forest">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  onFollow,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "attention" | "positive";
  href?: string;
  onFollow?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="size-4 text-moss-sage" aria-hidden />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </>
  );
  const toneClass =
    tone === "attention"
      ? "border-moss-warn-bg bg-moss-warn-bg/40"
      : tone === "positive"
        ? "border-moss-ok-bg bg-moss-ok-bg/30"
        : "";
  if (href || onFollow) {
    return (
      <button
        type="button"
        onClick={onFollow}
        data-nav={href}
        className={cn(
          "rounded-xl border bg-card p-4 text-left shadow-[0_1px_2px_rgba(32,40,32,0.04)] transition-colors hover:border-moss-sage/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          toneClass,
        )}
      >
        {body}
      </button>
    );
  }
  return <div className={cn("rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(32,40,32,0.04)]", toneClass)}>{body}</div>;
}

export function EvidenceList({
  evidence,
  className,
}: {
  evidence: { fileId?: string; fileName: string; excerpt: string; page?: number; location?: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {evidence.map((item, index) => (
        <li key={`${item.fileId ?? "ev"}-${index}`} className="rounded-lg border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-foreground">
            <span className="truncate">{item.fileName}</span>
            {item.page ? <span className="text-muted-foreground">· page {item.page}</span> : null}
            {item.location ? <span className="font-mono text-[0.68rem] text-muted-foreground">{item.location}</span> : null}
          </div>
          <blockquote className="mt-1.5 border-l-2 border-moss-sage/70 pl-2.5 text-[0.8rem] leading-relaxed text-muted-foreground">
            “{item.excerpt}”
          </blockquote>
        </li>
      ))}
    </ul>
  );
}

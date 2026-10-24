"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Moss brand mark — a moss sprig in a forest-green tile.
 * Pure SVG so it scales crisply and inherits no external assets.
 */
export function MossMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Moss"
    >
      <rect width="48" height="48" rx="12" className="fill-moss-forest" />
      <path d="M24 38c0-9 0-14 0-16" className="stroke-moss-sage" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M24 26c-7.2 0-11-3.6-11.6-10.4 7.6-.4 11.4 3.2 11.6 10.4Z" className="fill-moss-moss" />
      <path d="M24 22c6.4 0 9.8-3.2 10.4-9.2-6.8-.4-10.2 2.8-10.4 9.2Z" className="fill-moss-sage" />
      <path d="M17 38h14" className="stroke-moss-moss" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function MossLogo({
  size = 34,
  className,
  wordmarkClassName,
  tagline = false,
}: {
  size?: number;
  className?: string;
  wordmarkClassName?: string;
  tagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MossMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("text-[1.35rem] font-semibold tracking-tight text-foreground", wordmarkClassName)}>
          Moss
        </span>
        {tagline ? (
          <span className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            The Digital Backlog Gardener
          </span>
        ) : null}
      </span>
    </span>
  );
}

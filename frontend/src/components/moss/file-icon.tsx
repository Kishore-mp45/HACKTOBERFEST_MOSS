"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, File as FileIconGeneric, FileType2, Image as ImageIcon, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/types/domain";

const KIND_META: Record<FileKind, { icon: React.ElementType; label: string; className: string }> = {
  pdf: { icon: FileText, label: "PDF", className: "bg-moss-error-bg text-moss-error-fg" },
  docx: { icon: FileType2, label: "DOCX", className: "bg-moss-info-bg text-moss-info-fg" },
  md: { icon: FileIconGeneric, label: "MD", className: "bg-moss-mint text-moss-forest" },
  txt: { icon: FileIconGeneric, label: "TXT", className: "bg-muted text-muted-foreground" },
  xlsx: { icon: FileSpreadsheet, label: "XLSX", className: "bg-moss-ok-bg text-moss-ok-fg" },
  csv: { icon: Table2, label: "CSV", className: "bg-moss-ok-bg text-moss-ok-fg" },
  image: { icon: ImageIcon, label: "IMG", className: "bg-moss-warn-bg text-moss-warn-fg" },
};

export function FileTypeGlyph({
  kind,
  size = "md",
  className,
}: {
  kind: FileKind;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span
      aria-hidden
      title={meta.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold",
        size === "md" ? "size-9 text-[0.6rem]" : "size-7 text-[0.55rem]",
        meta.className,
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export { KIND_META as fileKindMeta };

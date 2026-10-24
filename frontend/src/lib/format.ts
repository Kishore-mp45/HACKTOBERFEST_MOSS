import type { FileKind } from "@/types/domain";

/** Human-readable byte sizes. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

/** Absolute short date, e.g. "12 Jun 2025". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Absolute date + time for audit-style rows. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(iso)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "3 min ago" style relative time, deterministic per render. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const fmt = (n: number, unit: string) =>
    future ? `in ${n} ${unit}${n === 1 ? "" : "s"}` : `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (abs < minute) return future ? "soon" : "just now";
  if (abs < hour) return fmt(Math.round(abs / minute), "min");
  if (abs < day) return fmt(Math.round(abs / hour), "hour");
  if (abs < 30 * day) return fmt(Math.round(abs / day), "day");
  return formatDate(iso);
}

/** Due-date rendering that never presents uncertain dates as confirmed. */
export function formatDueDate(iso: string | null, certainty: "explicit" | "inferred" | "uncertain"): string {
  if (certainty === "uncertain" || !iso) return "No certain date";
  const label = formatDate(iso);
  return certainty === "inferred" ? `~ ${label} (estimated)` : label;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function fileKindLabel(kind: FileKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
    case "md":
      return "Markdown";
    case "txt":
      return "Text";
    case "xlsx":
      return "Excel";
    case "csv":
      return "CSV";
    case "image":
      return "Image";
  }
}

/** Truncate long names from the middle so extensions stay visible. */
export function middleTruncate(value: string, max = 42): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

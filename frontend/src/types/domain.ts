/**
 * Moss — shared domain types.
 *
 * These types describe the API contract between the Moss frontend and its
 * FastAPI backend (see `docs/API_CONTRACT.md`). The mock provider
 * (`src/lib/api/mock.ts`) serves the same shapes, so switching from demo
 * data to a live backend is a configuration change, not a rewrite.
 */

export type FileKind = "pdf" | "docx" | "md" | "txt" | "xlsx" | "csv" | "image";

export type AnalysisStatus = "analyzed" | "pending" | "error";

export type RecommendationKind = "rename" | "move" | "archive" | "collection" | "duplicate_review";

export type RecommendationStatus = "pending" | "approved" | "rejected" | "applied" | "failed" | "dismissed";

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export type ActionItemStatus = "new" | "verified" | "dismissed" | "done";

export type DateCertainty = "explicit" | "inferred" | "uncertain";

export type CollectionOrigin = "ai" | "confirmed";

export type ActivityKind =
  | "scan"
  | "analysis"
  | "approval"
  | "rename"
  | "move"
  | "archive"
  | "collection"
  | "error"
  | "recovery"
  | "dismissal";

/** Evidence linking a claim (task, relationship, recommendation) back to its source document. */
export interface Evidence {
  fileId: string;
  fileName: string;
  /** Short verbatim excerpt from the document. */
  excerpt: string;
  /** 1-based page reference, when the source is a paginated document. */
  page?: number;
  /** Character offsets in the extracted text, when available. */
  location?: string;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  /** Path relative to the authorized workspace root. */
  path: string;
  kind: FileKind;
  sizeBytes: number;
  modifiedAt: string; // ISO timestamp
  status: AnalysisStatus;
  category: string | null;
  summary: string | null;
  topics: string[];
  keywords: string[];
  suggestedName?: string | null;
  suggestedFolder?: string | null;
  /** Populated for scanned/image documents. */
  ocrUsed?: boolean;
  errorMessage?: string | null;
}

export interface DocumentRelationship {
  id: string;
  sourceFileId: string;
  targetFileId: string;
  /** 0–1 similarity reported by the model. */
  similarity: number;
  rationale: string;
  discoveredAt?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  fileIds: string[];
  origin: CollectionOrigin;
  createdAt: string;
  /** Evidence excerpts supporting the grouping. */
  evidence: Evidence[];
}

export interface ActionItem {
  id: string;
  title: string;
  sourceFileId: string;
  evidence: Evidence;
  /** ISO date when certainty is explicit/inferred; null when uncertain. */
  dueDate: string | null;
  dateCertainty: DateCertainty;
  /** 0–1 model confidence. */
  confidence: number;
  status: ActionItemStatus;
  discoveredAt: string;
}

export type DuplicateKind = "exact" | "near" | "semantic";

export interface DuplicateGroup {
  id: string;
  kind: DuplicateKind;
  /** Detection method, e.g. "sha-256 hash match" or "embedding cosine similarity". */
  method: string;
  fileIds: string[];
  /** 0–1 similarity for near/semantic groups; 1 for exact. */
  similarity: number;
  reason: string;
  discoveredAt?: string;
  status: "open" | "dismissed";
}

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  /** Current value (filename, folder, etc.). */
  current: string;
  /** Proposed value (filename, folder, collection name, etc.). */
  proposed: string;
  rationale: string;
  evidence: Evidence[];
  risk: RiskLevel;
  /** 0–1 model confidence. */
  confidence: number;
  status: RecommendationStatus;
  createdAt: string;
  /** Set when an operation fails or conflicts (e.g. destination exists). */
  conflict?: string | null;
  /** Whether the backend reports reliable undo for this operation. */
  undoable?: boolean;
  /** Result message after execution. */
  resultMessage?: string | null;
}

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  createdAt: string;
  /** Backend-confirmed undo availability. Never assumed client-side. */
  undoable: boolean;
  undone?: boolean;
  /** Identifier used with POST /operations/{id}/undo. */
  operationId?: string;
  outcome: "success" | "partial" | "failure";
  relatedFileIds?: string[];
}

export type AnalysisStageId =
  | "discovery"
  | "extraction"
  | "analysis"
  | "relationships"
  | "tasks"
  | "recommendations";

export interface AnalysisStage {
  id: AnalysisStageId;
  label: string;
  state: "pending" | "running" | "done" | "error";
  processed: number;
  total: number;
  message?: string;
}

export interface AnalysisRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  state: "idle" | "running" | "completed" | "failed" | "partial";
  stages: AnalysisStage[];
  filesAnalyzed: number;
  errors: { fileId: string; fileName: string; message: string }[];
}

export type RuntimeStatus = "unknown" | "checking" | "available" | "unavailable";

export interface LocalRuntime {
  /** e.g. "Ollama (localhost:11434)". */
  provider: string;
  status: RuntimeStatus;
  modelId: string | null;
  detail: string | null;
  lastCheckedAt: string | null;
}

export interface WorkspaceSettings {
  /** Path the backend is authorized to index. Browser never gets filesystem access. */
  workspacePath: string | null;
  workspaceName: string;
  includedTypes: FileKind[];
  exclusions: string[];
  modelId: string | null;
  allowTelemetry: boolean;
  keepCache: boolean;
}

export interface WorkspaceStats {
  filesAnalyzed: number;
  filesPending: number;
  semanticGroups: number;
  duplicateCandidates: number;
  actionItems: number;
  pendingRecommendations: number;
  lastAnalyzedAt: string | null;
}

export interface OverviewSnapshot {
  stats: WorkspaceStats;
  attention: {
    fileId: string;
    fileName: string;
    reason: string;
    severity: "info" | "warning" | "error";
  }[];
  recentRelationships: DocumentRelationship[];
  recentActivity: ActivityEvent[];
}

/* ------------------------------------------------------------------ */
/* API client interface — mirrors the FastAPI contract                 */
/* ------------------------------------------------------------------ */

export interface ScanOptions {
  rescanAll: boolean;
}

/**
 * The single source of truth for frontend ↔ backend communication.
 * `HttpMossApi` implements this against FastAPI; `MockMossApi` implements
 * it with clearly-labelled synthetic data for demo and development.
 */
export interface MossApi {
  browseDirectories(path?: string): Promise<DirectoryListing>;
  configureWorkspace(path: string, name?: string): Promise<void>;
  getOverview(): Promise<OverviewSnapshot>;
  listFiles(): Promise<WorkspaceFile[]>;
  getFile(id: string): Promise<WorkspaceFile | null>;
  getFileRelationships(id: string): Promise<DocumentRelationship[]>;
  listCollections(): Promise<Collection[]>;
  confirmCollection(id: string): Promise<Collection>;
  dismissCollection(id: string): Promise<void>;
  listActionItems(): Promise<ActionItem[]>;
  updateActionItem(id: string, status: ActionItemStatus): Promise<ActionItem>;
  listDuplicates(): Promise<DuplicateGroup[]>;
  setDuplicateStatus(id: string, status: "open" | "dismissed"): Promise<DuplicateGroup>;
  listRecommendations(): Promise<Recommendation[]>;
  updateRecommendation(
    id: string,
    patch: Partial<Pick<Recommendation, "proposed" | "status">>,
  ): Promise<Recommendation>;
  approveRecommendations(ids: string[]): Promise<void>;
  /** Executes an approved operation. The backend validates and logs everything. */
  executeRecommendation(id: string): Promise<Recommendation>;
  undoOperation(operationId: string): Promise<ActivityEvent>;
  listActivity(): Promise<ActivityEvent[]>;
  getSettings(): Promise<WorkspaceSettings>;
  saveSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings>;
  checkRuntime(): Promise<LocalRuntime>;
  /** Starts an analysis; progress is streamed, with job polling as a fallback. */
  startScan(options: ScanOptions): Promise<AnalysisRun>;
  getAnalysisRun(id: string | "current"): Promise<AnalysisRun | null>;
  watchAnalysisRun(
    id: string,
    onUpdate: (run: AnalysisRun) => void,
    onError: (error: Error) => void,
  ): () => void;
  /** Connectivity probe used by error/offline states. */
  ping(): Promise<{ ok: boolean; mode: "live" | "mock" }>;
}

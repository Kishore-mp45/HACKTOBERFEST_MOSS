"use client";

import type {
  ActionItem,
  ActivityEvent,
  AnalysisRun,
  Collection,
  DirectoryListing,
  DocumentRelationship,
  DuplicateGroup,
  LocalRuntime,
  MossApi,
  OverviewSnapshot,
  Recommendation,
  ScanOptions,
  WorkspaceFile,
  WorkspaceSettings,
} from "@/types/domain";

type ApiFile = {
  id: string;
  name: string;
  path: string;
  kind: string;
  size_bytes: number;
  modified_at: string | null;
  status: string;
  category: string | null;
  summary: string | null;
  topics: string[];
  keywords: string[];
  suggested_name: string | null;
  suggested_folder: string | null;
  ocr_used: boolean;
  error_message: string | null;
};

type ApiJob = {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  error_log: { error?: string; file?: string }[];
  started_at: string | null;
  finished_at: string | null;
};

type ApiWorkspace = {
  name: string;
  root_path: string;
} | null;

type ApiRecommendation = {
  id: string;
  file_id: string;
  relative_path: string;
  rec_type: string;
  explanation: string;
  confidence: string;
  status: string;
  created_at: string;
  proposed_operation: {
    op_type: string;
    source_path: string;
    dest_path: string;
    new_name: string | null;
  } | null;
  result_message: string | null;
};

const FILE_KINDS = new Set(["pdf", "docx", "md", "txt", "xlsx", "csv", "image"]);
const SCAN_STAGES = [
  ["discovery", "Discover files"],
  ["extraction", "Extract text"],
  ["analysis", "Analyze documents"],
  ["relationships", "Connect related files"],
  ["tasks", "Find action items"],
  ["recommendations", "Prepare recommendations"],
] as const;

export class MossApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "MossApiError";
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;
const API_PREFIX = "/api";

function fileKind(value: string): WorkspaceFile["kind"] {
  return FILE_KINDS.has(value) ? (value as WorkspaceFile["kind"]) : "txt";
}

function mapFile(file: ApiFile): WorkspaceFile {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    kind: fileKind(file.kind),
    sizeBytes: file.size_bytes,
    modifiedAt: file.modified_at ?? "",
    status: file.status === "analyzed" || file.status === "error" ? file.status : "pending",
    category: file.category,
    summary: file.summary,
    topics: file.topics,
    keywords: file.keywords,
    suggestedName: file.suggested_name,
    suggestedFolder: file.suggested_folder,
    ocrUsed: file.ocr_used,
    errorMessage: file.error_message,
  };
}

function confidence(value: string): number {
  switch (value.toLowerCase()) {
    case "high":
      return 0.9;
    case "medium":
      return 0.65;
    case "low":
      return 0.4;
    default:
      return 0;
  }
}

function actionStatus(value: string): ActionItem["status"] {
  const statuses: Record<string, ActionItem["status"]> = {
    NEW: "new",
    VERIFIED: "verified",
    DONE: "done",
    DISMISSED: "dismissed",
  };
  const status = statuses[value.toUpperCase()];
  if (!status) {
    throw new MossApiError(`The API returned an unsupported action status: ${value}`, 502, `${API_PREFIX}/actions`);
  }
  return status;
}

function duplicateStatus(value: string): DuplicateGroup["status"] {
  const statuses: Record<string, DuplicateGroup["status"]> = {
    OPEN: "open",
    DISMISSED: "dismissed",
  };
  const status = statuses[value.toUpperCase()];
  if (!status) {
    throw new MossApiError(`The API returned an unsupported duplicate status: ${value}`, 502, `${API_PREFIX}/duplicates`);
  }
  return status;
}

function recommendationStatus(value: string): Recommendation["status"] {
  const statuses: Record<string, Recommendation["status"]> = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    APPLIED: "applied",
    FAILED: "failed",
    CONFLICT: "failed",
    DISMISSED: "dismissed",
  };
  const status = statuses[value.toUpperCase()];
  if (!status) {
    throw new MossApiError(
      `The API returned an unsupported recommendation status: ${value}`,
      502,
      `${API_PREFIX}/recommendations`,
    );
  }
  return status;
}

function recommendationKind(value: string): Recommendation["kind"] {
  const kinds: Record<string, Recommendation["kind"]> = {
    rename: "rename",
    move: "move",
    group_tag: "collection",
    duplicate_review: "duplicate_review",
    archive: "archive",
  };
  const kind = kinds[value.toLowerCase()];
  if (!kind) {
    throw new MossApiError(
      `The API returned an unsupported recommendation type: ${value}`,
      502,
      `${API_PREFIX}/recommendations`,
    );
  }
  return kind;
}

function workspaceSettings(workspace: ApiWorkspace): WorkspaceSettings {
  return {
    workspacePath: workspace?.root_path ?? null,
    workspaceName: workspace?.name ?? "Workspace",
    includedTypes: ["pdf", "docx", "md", "txt"],
    exclusions: [],
    modelId: null,
    allowTelemetry: false,
    keepCache: true,
  };
}

type ApiActivity = {
  id: string;
  kind: ActivityEvent["kind"];
  title: string;
  detail: string;
  created_at: string;
  undoable: boolean;
  outcome: ActivityEvent["outcome"];
  related_file_ids: string[];
  undone?: boolean;
  operation_id?: string | null;
};

function mapActivity(event: ApiActivity): ActivityEvent {
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    detail: event.detail,
    createdAt: event.created_at,
    undoable: event.undoable,
    undone: event.undone,
    operationId: event.operation_id ?? undefined,
    outcome: event.outcome,
    relatedFileIds: event.related_file_ids,
  };
}

function mapRecommendation(recommendation: ApiRecommendation): Recommendation {
  const operation = recommendation.proposed_operation;
  const kind = recommendationKind(recommendation.rec_type);
  return {
    id: recommendation.id,
    kind,
    title: `${kind[0].toUpperCase()}${kind.slice(1)} recommendation`,
    current: operation?.source_path ?? recommendation.relative_path,
    proposed: operation
      ? operation.op_type.toUpperCase() === "RENAME"
        ? operation.new_name ?? recommendation.relative_path.split(/[\\/]/).pop() ?? recommendation.relative_path
        : (operation.dest_path.replace(/[\\/][^\\/]+$/, "") || ".") + "/"
      : recommendation.relative_path,
    rationale: recommendation.explanation,
    evidence: [],
    risk: "unknown",
    confidence: confidence(recommendation.confidence),
    status: recommendationStatus(recommendation.status),
    createdAt: recommendation.created_at,
    conflict: ["CONFLICT", "FAILED"].includes(recommendation.status.toUpperCase())
      ? recommendation.explanation
      : null,
    undoable: false,
    resultMessage: recommendation.result_message,
  };
}

export class HttpMossApi implements MossApi {
  private currentJobId: string | null = null;
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const endpoint = `${API_PREFIX}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        let detail = "";
        try {
          const payload: unknown = await response.json();
          detail =
            typeof payload === "object" && payload !== null && "detail" in payload
              ? String(payload.detail)
              : JSON.stringify(payload);
        } catch {
          detail = await response.text().catch(() => "");
        }
        throw new MossApiError(
          detail || `${method} ${endpoint} failed with status ${response.status}`,
          response.status,
          endpoint,
        );
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MossApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new MossApiError(`Request to ${endpoint} timed out after ${this.timeoutMs} ms.`, 0, endpoint);
      }
      throw new MossApiError(
        `Cannot reach the Moss backend at ${this.baseUrl}. Is the FastAPI server running?`,
        0,
        endpoint,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async browseDirectories(path?: string): Promise<DirectoryListing> {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return this.request("GET", `/workspace/browse${query}`);
  }

  async configureWorkspace(path: string, name?: string): Promise<void> {
    await this.request("POST", "/workspace/configure", { path, name });
  }

  async ping() {
    const response = await this.request<{ status: string }>("GET", "/health");
    return { ok: response.status === "ok", mode: "live" as const };
  }

  async getOverview(): Promise<OverviewSnapshot> {
    const data = await this.request<{
      stats: {
        files_analyzed: number;
        files_pending: number;
        semantic_groups: number;
        duplicate_candidates: number;
        action_items: number;
        pending_recommendations: number;
        last_analyzed_at: string | null;
      };
      attention: { file_id: string; file_name: string; reason: string; severity: "info" | "warning" | "error" }[];
      recent_relationships: {
        id: string;
        source_file_id: string;
        target_file_id: string;
        similarity: number;
        rationale: string;
      }[];
      recent_activity: ApiActivity[];
    }>("GET", "/overview");
    return {
      stats: {
        filesAnalyzed: data.stats.files_analyzed,
        filesPending: data.stats.files_pending,
        semanticGroups: data.stats.semantic_groups,
        duplicateCandidates: data.stats.duplicate_candidates,
        actionItems: data.stats.action_items,
        pendingRecommendations: data.stats.pending_recommendations,
        lastAnalyzedAt: data.stats.last_analyzed_at,
      },
      attention: data.attention.map((item) => ({
        fileId: item.file_id,
        fileName: item.file_name,
        reason: item.reason,
        severity: item.severity,
      })),
      recentRelationships: data.recent_relationships.map((relationship) => ({
        id: relationship.id,
        sourceFileId: relationship.source_file_id,
        targetFileId: relationship.target_file_id,
        similarity: relationship.similarity,
        rationale: relationship.rationale,
      })),
      recentActivity: data.recent_activity.map(mapActivity),
    };
  }

  async listFiles(): Promise<WorkspaceFile[]> {
    const files = await this.request<ApiFile[]>("GET", "/files");
    return files.map(mapFile);
  }

  async getFile(id: string): Promise<WorkspaceFile | null> {
    try {
      return mapFile(await this.request<ApiFile>("GET", `/files/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof MossApiError && error.status === 404) return null;
      throw error;
    }
  }

  async getFileRelationships(id: string): Promise<DocumentRelationship[]> {
    const relationships = await this.request<
      {
        file_id: string;
        relative_path: string;
        relationship_type: string;
        similarity_score: number;
        cluster_id: string | null;
      }[]
    >("GET", `/files/${encodeURIComponent(id)}/relationships`);
    return relationships.map((relationship) => ({
      id: `${id}:${relationship.file_id}:${relationship.relationship_type}`,
      sourceFileId: id,
      targetFileId: relationship.file_id,
      similarity: relationship.similarity_score,
      rationale: relationship.relationship_type.replaceAll("_", " ").toLowerCase(),
    }));
  }

  async listCollections(): Promise<Collection[]> {
    const collections = await this.request<
      {
        id: string;
        name: string;
        description: string;
        keywords: string[];
        file_ids: string[];
        origin: "ai" | "confirmed";
        created_at: string;
        evidence: Collection["evidence"];
      }[]
    >("GET", "/collections");
    return collections.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      keywords: item.keywords,
      fileIds: item.file_ids,
      origin: item.origin,
      createdAt: item.created_at,
      evidence: item.evidence,
    }));
  }

  confirmCollection(id: string) {
    return this.request<{ id: string; status: string }>(
      "POST",
      `/collections/${encodeURIComponent(id)}/confirm`,
    ).then(async () => {
      const collection = (await this.listCollections()).find((item) => item.id === id);
      if (!collection) {
        throw new MossApiError("The confirmed collection is no longer available.", 404, `${API_PREFIX}/collections`);
      }
      return collection;
    });
  }

  async dismissCollection(id: string) {
    await this.request<{ id: string; status: string }>(
      "POST",
      `/collections/${encodeURIComponent(id)}/dismiss`,
    );
  }

  async listActionItems(): Promise<ActionItem[]> {
    const actions = await this.request<
      {
        id: string;
        file_id: string;
        relative_path: string;
        description: string;
        source_text: string;
        date_hint: string | null;
        date_verified: boolean;
        confidence: string;
        extracted_at: string;
        status: string;
      }[]
    >("GET", "/actions");
    return actions.map((action) => {
      const fileName = action.relative_path.split(/[\\/]/).pop() ?? action.relative_path;
      const dueDate = action.date_hint && !Number.isNaN(Date.parse(action.date_hint))
        ? new Date(action.date_hint).toISOString()
        : null;
      return {
        id: action.id,
        title: action.description,
        sourceFileId: action.file_id,
        evidence: {
          fileId: action.file_id,
          fileName,
          excerpt: action.source_text,
        },
        dueDate,
        dateCertainty: dueDate && action.date_verified ? "explicit" : "uncertain",
        confidence: confidence(action.confidence),
        status: actionStatus(action.status),
        discoveredAt: action.extracted_at,
      };
    });
  }

  async updateActionItem(id: string, status: ActionItem["status"]) {
    await this.request<{ id: string; status: string }>(
      "POST",
      `/actions/${encodeURIComponent(id)}/status`,
      { status },
    );
    const item = (await this.listActionItems()).find((action) => action.id === id);
    if (!item) throw new MossApiError("The updated action item is no longer available.", 404, `${API_PREFIX}/actions`);
    return item;
  }

  async listDuplicates(): Promise<DuplicateGroup[]> {
    const duplicates = await this.request<
      {
        file_a_id: string;
        file_a_path: string;
        file_b_id: string;
        file_b_path: string;
        duplicate_type: string;
        similarity_score: number;
        id: string;
        status: string;
      }[]
    >("GET", "/duplicates");
    return duplicates.map((duplicate) => ({
      id: duplicate.id,
      kind: duplicate.duplicate_type === "EXACT_DUPLICATE" ? "exact" : "near",
      method:
        duplicate.duplicate_type === "EXACT_DUPLICATE"
          ? "SHA-256 hash match"
          : "Embedding similarity",
      fileIds: [duplicate.file_a_id, duplicate.file_b_id],
      similarity: duplicate.similarity_score,
      reason: `${duplicate.file_a_path} and ${duplicate.file_b_path} were identified as duplicates.`,
      status: duplicateStatus(duplicate.status),
    }));
  }

  async setDuplicateStatus(id: string, status: DuplicateGroup["status"]) {
    await this.request<{ id: string; status: string }>(
      "POST",
      `/duplicates/${encodeURIComponent(id)}/status`,
      { status },
    );
    const group = (await this.listDuplicates()).find((duplicate) => duplicate.id === id);
    if (!group) throw new MossApiError("The updated duplicate candidate is no longer available.", 404, `${API_PREFIX}/duplicates`);
    return group;
  }

  async listRecommendations(): Promise<Recommendation[]> {
    return (await this.request<ApiRecommendation[]>("GET", "/recommendations")).map(
      mapRecommendation,
    );
  }

  async updateRecommendation(
    id: string,
    patch: Partial<Pick<Recommendation, "proposed" | "status">>,
  ) {
    const encodedId = encodeURIComponent(id);
    let result: ApiRecommendation;
    if (patch.proposed !== undefined) {
      result = await this.request<ApiRecommendation>(
        "POST",
        `/recommendations/${encodedId}/edit`,
        { proposed: patch.proposed },
      );
    } else if (patch.status === "approved" || patch.status === "rejected") {
      result = await this.request<ApiRecommendation>(
        "POST",
        `/approvals/${encodedId}`,
        { decision: patch.status === "approved" ? "approve" : "reject" },
      );
    } else {
      throw new MossApiError("Unsupported recommendation update.", 422, `${API_PREFIX}/recommendations/${encodedId}`);
    }
    return mapRecommendation(result);
  }

  async approveRecommendations(ids: string[]) {
    await this.request("POST", "/approvals/batch", {
      recommendation_ids: ids,
      decision: "approve",
    });
  }

  async executeRecommendation(id: string) {
    const result = await this.request<ApiRecommendation>(
      "POST",
      `/recommendations/${encodeURIComponent(id)}/execute`,
    );
    return mapRecommendation(result);
  }

  async undoOperation(operationId: string) {
    return mapActivity(
      await this.request<ApiActivity>(
        "POST",
        `/operations/${encodeURIComponent(operationId)}/undo`,
      ),
    );
  }

  async listActivity(): Promise<ActivityEvent[]> {
    const events = await this.request<
      {
        id: string;
        kind: ActivityEvent["kind"];
        title: string;
        detail: string;
        created_at: string;
        undoable: boolean;
        outcome: ActivityEvent["outcome"];
        related_file_ids: string[];
      }[]>("GET", "/activity");
    return events.map(mapActivity);
  }

  async getSettings(): Promise<WorkspaceSettings> {
    const workspace = await this.request<ApiWorkspace>("GET", "/workspace");
    return workspaceSettings(workspace);
  }

  async saveSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings> {
    if (!settings.workspacePath) {
      throw new MossApiError("Choose a workspace folder before saving settings.", 422, `${API_PREFIX}/workspace`);
    }
    await this.configureWorkspace(settings.workspacePath, settings.workspaceName);
    return settings;
  }

  async checkRuntime(): Promise<LocalRuntime> {
    const result = await this.request<{
      ollama_available: boolean;
      llm_model: string;
      llm_available: boolean;
      embedding_model: string;
      embedding_available: boolean;
      error: string | null;
    }>("GET", "/health/model-status");
    const available = result.ollama_available && result.llm_available && result.embedding_available;
    return {
      provider: "Ollama (localhost)",
      status: available ? "available" : "unavailable",
      modelId: result.llm_model,
      detail: result.error
        ? result.error
        : `LLM ${result.llm_model}: ${result.llm_available ? "available" : "missing"}; embeddings ${result.embedding_model}: ${result.embedding_available ? "available" : "missing"}.`,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async startScan(options: ScanOptions): Promise<AnalysisRun> {
    const job = await this.request<ApiJob>("POST", "/jobs/scan", {
      force_reindex: options.rescanAll,
    });
    this.currentJobId = job.id;
    return this.mapJob(job);
  }

  async getAnalysisRun(id: string | "current"): Promise<AnalysisRun | null> {
    const jobId = id === "current" ? this.currentJobId : id;
    if (!jobId) return null;
    return this.mapJob(await this.request<ApiJob>("GET", `/jobs/${encodeURIComponent(jobId)}`));
  }

  watchAnalysisRun(
    id: string,
    onUpdate: (run: AnalysisRun) => void,
    onError: (error: Error) => void,
  ): () => void {
    const endpoint = `${API_PREFIX}/jobs/${encodeURIComponent(id)}/events`;
    const source = new EventSource(`${this.baseUrl}${endpoint}`);
    let closed = false;
    let latest: AnalysisRun = {
      id,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      state: "running",
      stages: SCAN_STAGES.map(([stageId, label]) => ({
        id: stageId,
        label,
        state: "pending",
        processed: 0,
        total: 0,
      })),
      filesAnalyzed: 0,
      errors: [],
    };

    source.onmessage = (message) => {
      try {
        const event: unknown = JSON.parse(message.data);
        if (typeof event !== "object" || event === null || !("type" in event)) {
          throw new Error("The scan event had an unexpected format.");
        }
        const payload = event as {
          type: string;
          stage?: string;
          processed?: number;
          total?: number;
          current_file?: string;
          error?: string;
          processed_files?: number;
          errors?: { file?: string; error?: string }[];
        };

        if (payload.type === "progress") {
          const stageName = payload.stage?.toLowerCase() ?? "";
          const activeIndex =
            stageName === "extraction" || stageName === "cache" || stageName === "skipped"
              ? 1
              : stageName === "classification" || stageName === "analysis"
                ? 2
                : stageName.includes("action")
                    ? 2
                  : stageName === "error"
                    ? 2
                    : 0;
          latest = {
            ...latest,
            stages: latest.stages.map((stage, index) => ({
              ...stage,
              state: index < activeIndex ? "done" : index === activeIndex ? "running" : "pending",
              processed: index === activeIndex ? payload.processed ?? 0 : index < activeIndex ? stage.total : 0,
              total: payload.total ?? stage.total,
              message: index === activeIndex ? payload.current_file : undefined,
            })),
            filesAnalyzed: payload.processed ?? latest.filesAnalyzed,
          };
          if (stageName === "error" && payload.current_file) {
            latest.errors = [
              ...latest.errors,
              {
                fileId: payload.current_file,
                fileName: payload.current_file,
                message: payload.error ?? "The file could not be processed.",
              },
            ];
          }
          onUpdate(latest);
          return;
        }

        if (payload.type === "complete") {
          const errors = (payload.errors ?? []).map((item) => ({
            fileId: item.file ?? "",
            fileName: item.file ?? "Unknown file",
            message: item.error ?? "The file could not be processed.",
          }));
          latest = {
            ...latest,
            finishedAt: new Date().toISOString(),
            state: errors.length ? "partial" : "completed",
            stages: latest.stages.map((stage) => ({
              ...stage,
              state: "done",
              processed: payload.processed_files ?? stage.total,
            })),
            filesAnalyzed: payload.processed_files ?? latest.filesAnalyzed,
            errors,
          };
          onUpdate(latest);
          source.close();
          closed = true;
          return;
        }

        if (payload.type === "error") {
          latest = {
            ...latest,
            finishedAt: new Date().toISOString(),
            state: "failed",
            errors: [
              {
                fileId: "",
                fileName: "Scan",
                message: payload.error ?? "The scan failed.",
              },
            ],
            stages: latest.stages.map((stage, index) => ({
              ...stage,
              state: index === 0 ? "error" : stage.state,
            })),
          };
          onUpdate(latest);
          source.close();
          closed = true;
        }
      } catch (error) {
        source.close();
        closed = true;
        onError(error instanceof Error ? error : new Error("Could not read scan progress."));
      }
    };

    source.onerror = () => {
      if (closed) return;
      source.close();
      closed = true;
      onError(new MossApiError("The live scan event stream disconnected.", 0, endpoint));
    };

    return () => {
      closed = true;
      source.close();
    };
  }

  private mapJob(job: ApiJob): AnalysisRun {
    const state: AnalysisRun["state"] =
      job.status === "COMPLETED"
        ? "completed"
        : job.status === "COMPLETED_WITH_ERRORS"
          ? "partial"
          : job.status === "FAILED" || job.status === "INTERRUPTED"
            ? "failed"
            : "running";
    const terminal = state !== "running";
    const total = job.total_files;
    const processed = job.processed_files;
    const queued = job.status === "QUEUED";
    return {
      id: job.id,
      startedAt: job.started_at ?? new Date().toISOString(),
      finishedAt: job.finished_at,
      state,
      stages: SCAN_STAGES.map(([id, label], index) => ({
        id,
        label,
        state: terminal
          ? state === "failed"
            ? index === 0
              ? "error"
              : "pending"
            : "done"
          : queued
            ? index === 0
              ? "running"
              : "pending"
            : index === 0
              ? "done"
              : index === 1
                ? "running"
                : "pending",
        processed: index === (queued ? 0 : 1) ? processed : terminal ? total : 0,
        total,
      })),
      filesAnalyzed: processed,
      errors: job.error_log.map((item) => ({
        fileId: item.file ?? "",
        fileName: item.file ?? "Unknown file",
        message: item.error ?? "The scan reported an error.",
      })),
    };
  }
}

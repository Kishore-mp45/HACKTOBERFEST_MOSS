"use client";

/**
 * Mock MossApi — clearly-labelled synthetic implementation of the Moss API
 * contract. Used when no backend URL is configured (default in this sandbox).
 *
 * Honesty rules baked in:
 * - `ping()` reports mode "mock" so the UI can show a Demo-data badge.
 * - `checkRuntime()` never claims a local model is running.
 * - Analysis progress reflects a simulated pipeline, not fabricated instant results.
 * - Failures are modelled too (the seeded failed move + its conflict).
 */

import type {
  ActionItem,
  ActivityEvent,
  AnalysisRun,
  Collection,
  DocumentRelationship,
  DirectoryListing,
  DuplicateGroup,
  LocalRuntime,
  MossApi,
  OverviewSnapshot,
  Recommendation,
  ScanOptions,
  WorkspaceFile,
  WorkspaceSettings,
} from "@/types/domain";
import {
  seedActionItems,
  seedActivity,
  seedAnalysisStages,
  seedCollections,
  seedDuplicates,
  seedFiles,
  seedOverview,
  seedRecommendations,
  seedRelationships,
  seedRuntime,
  seedSettings,
} from "@/mocks/seed";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let opCounter = 1003;

export class MockMossApi implements MossApi {
  private files: WorkspaceFile[] = clone(seedFiles);
  private relationships: DocumentRelationship[] = clone(seedRelationships);
  private collections: Collection[] = clone(seedCollections);
  private actionItems: ActionItem[] = clone(seedActionItems);
  private duplicates: DuplicateGroup[] = clone(seedDuplicates);
  private recommendations: Recommendation[] = clone(seedRecommendations);
  private activity: ActivityEvent[] = clone(seedActivity);
  private settings: WorkspaceSettings = clone(seedSettings);
  private runtime: LocalRuntime = clone(seedRuntime);
  private currentRun: AnalysisRun | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  async browseDirectories(path?: string): Promise<DirectoryListing> {
    await delay(100);
    throw new Error("Directory browsing is unavailable in demo mode.");
  }

  async configureWorkspace(path: string, name?: string): Promise<void> {
    await delay(120);
    this.settings = {
      ...this.settings,
      workspacePath: path,
      workspaceName: name || this.settings.workspaceName,
    };
  }

  private log(event: Omit<ActivityEvent, "id" | "createdAt">): ActivityEvent {
    const entry: ActivityEvent = {
      ...event,
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    this.activity.unshift(entry);
    return entry;
  }

  async ping() {
    await delay(120);
    return { ok: true, mode: "mock" as const };
  }

  async getOverview(): Promise<OverviewSnapshot> {
    await delay(200);
    const snapshot = seedOverview();
    // Reflect live mutations (scan results, approvals) instead of static seeds.
    snapshot.stats = {
      filesAnalyzed: this.files.filter((f) => f.status === "analyzed").length,
      filesPending: this.files.filter((f) => f.status === "pending").length,
      semanticGroups: this.collections.length,
      duplicateCandidates: this.duplicates.filter((d) => d.status === "open").length,
      actionItems: this.actionItems.filter((a) => a.status === "new" || a.status === "verified").length,
      pendingRecommendations: this.recommendations.filter((r) => r.status === "pending").length,
      lastAnalyzedAt: this.currentRun?.finishedAt ?? snapshot.stats.lastAnalyzedAt,
    };
    snapshot.recentRelationships = this.relationships.slice(0, 4);
    snapshot.recentActivity = this.activity.slice(0, 4);
    snapshot.attention = snapshot.attention.filter((a) => {
      const file = this.files.find((f) => f.id === a.fileId);
      if (!file) return false;
      if (a.severity === "error") return file.status === "error";
      if (a.fileId === "f-17") return file.status === "pending";
      if (a.fileId === "f-04") return this.duplicates.find((d) => d.id === "d-2")?.status === "open";
      return true;
    });
    return snapshot;
  }

  async listFiles() {
    await delay(220);
    return clone(this.files);
  }

  async getFile(id: string) {
    await delay(120);
    return this.files.find((f) => f.id === id) ?? null;
  }

  async getFileRelationships(id: string) {
    await delay(150);
    return clone(this.relationships.filter((r) => r.sourceFileId === id || r.targetFileId === id));
  }

  async listCollections() {
    await delay(200);
    return clone(this.collections);
  }

  async confirmCollection(id: string) {
    await delay(260);
    const collection = this.collections.find((c) => c.id === id);
    if (!collection) throw new Error("Collection not found");
    collection.origin = "confirmed";
    this.log({
      kind: "collection",
      title: `Confirmed collection '${collection.name}'`,
      detail: "AI-suggested grouping was promoted to a user-confirmed collection.",
      undoable: false,
      outcome: "success",
    });
    return clone(collection);
  }

  async dismissCollection(id: string) {
    await delay(200);
    const collection = this.collections.find((c) => c.id === id);
    if (!collection) throw new Error("Collection not found");
    this.collections = this.collections.filter((c) => c.id !== id);
    this.log({
      kind: "dismissal",
      title: `Dismissed suggested collection '${collection.name}'`,
      detail: "Removed from Collections. Files were not touched. It may reappear after a full rescan.",
      undoable: false,
      outcome: "success",
    });
  }

  async listActionItems() {
    await delay(200);
    return clone(this.actionItems);
  }

  async updateActionItem(id: string, status: ActionItem["status"]) {
    await delay(180);
    const item = this.actionItems.find((a) => a.id === id);
    if (!item) throw new Error("Action item not found");
    item.status = status;
    if (status === "dismissed") {
      this.log({
        kind: "dismissal",
        title: `Dismissed action item '${item.title}'`,
        detail: "Marked as not relevant. Dismissals are remembered for this document version.",
        undoable: false,
        outcome: "success",
      });
    }
    if (status === "verified") {
      this.log({
        kind: "approval",
        title: `Verified action item '${item.title}'`,
        detail: "You confirmed the extracted task and its date.",
        undoable: false,
        outcome: "success",
      });
    }
    return clone(item);
  }

  async listDuplicates() {
    await delay(200);
    return clone(this.duplicates);
  }

  async setDuplicateStatus(id: string, status: DuplicateGroup["status"]) {
    await delay(180);
    const group = this.duplicates.find((d) => d.id === id);
    if (!group) throw new Error("Duplicate group not found");
    group.status = status;
    if (status === "dismissed") {
      this.log({
        kind: "dismissal",
        title: `Dismissed duplicate candidate (${group.method})`,
        detail: "No files were modified — duplicates are never deleted automatically.",
        undoable: false,
        outcome: "success",
      });
    }
    return clone(group);
  }

  async listRecommendations() {
    await delay(200);
    return clone(this.recommendations);
  }

  async updateRecommendation(id: string, patch: Partial<Pick<Recommendation, "proposed" | "status">>) {
    await delay(180);
    const rec = this.recommendations.find((r) => r.id === id);
    if (!rec) throw new Error("Recommendation not found");
    if (rec.status !== "pending" && patch.proposed) {
      throw new Error("Only pending recommendations can be edited.");
    }
    if (patch.proposed !== undefined) rec.proposed = patch.proposed;
    if (patch.status !== undefined) {
      rec.status = patch.status;
      if (patch.status === "approved") {
        this.log({
          kind: "approval",
          title: `Approved: ${rec.title}`,
          detail: "No file was changed. Execution requires a separate confirmation.",
          undoable: false,
          outcome: "success",
        });
      } else if (patch.status === "rejected" || patch.status === "dismissed") {
        this.log({
          kind: "dismissal",
          title: `Rejected suggestion: ${rec.title}`,
          detail: "Moss will not raise the same proposal for this file version again.",
          undoable: false,
          outcome: "success",
        });
      }
    }
    return clone(rec);
  }

  async approveRecommendations(ids: string[]) {
    for (const id of ids) {
      await this.updateRecommendation(id, { status: "approved" });
    }
  }

  async executeRecommendation(id: string) {
    await delay(900);
    const rec = this.recommendations.find((r) => r.id === id);
    if (!rec) throw new Error("Recommendation not found");
    if (rec.status !== "approved") {
      throw new Error("Approve this recommendation before execution.");
    }

    const operationId = `op-${opCounter++}`;
    const file =
      this.files.find((f) => f.name === rec.current || f.path === rec.current) ??
      this.files.find((f) => rec.current.endsWith(f.name));

    // Simulated conflict: executing a move twice, or into an occupied folder.
    if (rec.kind === "move" && rec.proposed.includes("Invoices")) {
      rec.status = "failed";
      rec.conflict = "Destination 'Apartment/Invoices/' already contains a file with the same name.";
      rec.resultMessage = "Operation aborted — nothing was changed.";
      this.log({
        kind: "error",
        title: `Move failed: ${rec.title}`,
        detail: `${rec.conflict} Nothing was changed.`,
        undoable: false,
        outcome: "failure",
      });
      return clone(rec);
    }

    switch (rec.kind) {
      case "rename": {
        if (file) {
          file.name = rec.proposed;
          file.path = file.path.replace(/[^/]+$/, rec.proposed);
          file.suggestedName = null;
        }
        rec.status = "applied";
        rec.resultMessage = `Renamed to '${rec.proposed}'. Reversible via Activity.`;
        this.log({
          kind: "rename",
          title: `Renamed '${rec.current}' → '${rec.proposed}'`,
          detail: `Approved from the review queue. Operation ${operationId}; reversible.`,
          undoable: true,
          operationId,
          outcome: "success",
        });
        break;
      }
      case "move":
      case "archive": {
        if (file) {
          file.path = `${rec.proposed}${file.name}`;
          if (rec.kind === "archive") file.suggestedFolder = null;
        }
        rec.status = "applied";
        rec.resultMessage = `Moved to ${rec.kind === "archive" ? "archive" : "folder"} — reversible via Activity.`;
        this.log({
          kind: rec.kind === "archive" ? "archive" : "move",
          title: `${rec.kind === "archive" ? "Archived" : "Moved"} '${rec.current}'`,
          detail: `Destination: ${rec.proposed} · Operation ${operationId}; reversible.`,
          undoable: true,
          operationId,
          outcome: "success",
        });
        break;
      }
      case "collection": {
        const created: Collection = {
          id: `c-${Date.now()}`,
          name: rec.proposed.replace(/\s*\(.*\)$/, ""),
          description: rec.rationale,
          keywords: ["receipts", "invoices", "expenses"],
          fileIds: rec.evidence.map((e) => e.fileId),
          origin: "confirmed",
          createdAt: new Date().toISOString(),
          evidence: rec.evidence,
        };
        this.collections.push(created);
        rec.status = "applied";
        rec.resultMessage = `Collection '${created.name}' created with ${created.fileIds.length} files.`;
        this.log({
          kind: "collection",
          title: `Created collection '${created.name}'`,
          detail: "Files were grouped; nothing was moved or renamed.",
          undoable: false,
          outcome: "success",
        });
        break;
      }
      case "duplicate_review": {
        rec.status = "applied";
        rec.resultMessage = "Duplicate review recorded; neither file was changed.";
        this.log({
          kind: "dismissal",
          title: `Reviewed duplicate candidate: ${rec.title}`,
          detail: "Both files remain untouched.",
          undoable: false,
          outcome: "success",
        });
        break;
      }
    }

    return clone(rec);
  }

  async undoOperation(operationId: string) {
    await delay(650);
    const event = this.activity.find((e) => e.operationId === operationId);
    if (!event) throw new Error("Operation not found");
    if (!event.undoable) throw new Error("The backend reports this operation cannot be reversed.");
    if (event.undone) throw new Error("This operation was already undone.");

    // Reverse the effect on the workspace state.
    if (event.kind === "rename") {
      const match = /Renamed '(.+)' → '(.+)'/.exec(event.title);
      if (match) {
        const file = this.files.find((f) => f.name === match[2]);
        if (file) {
          file.name = match[1];
          file.path = file.path.replace(/[^/]+$/, match[1]);
        }
      }
    }
    if (event.kind === "move" || event.kind === "archive") {
      const file = event.relatedFileIds?.length ? this.files.find((f) => f.id === event.relatedFileIds![0]) : undefined;
      const from = /Destination: (.+) ·/.exec(event.detail)?.[1];
      if (file && from) file.path = `${from}${file.name}`.replace(/Archive\/2026\//, "Work/");
    }

    event.undone = true;
    const recovery = this.log({
      kind: "recovery",
      title: `Undone: ${event.title}`,
      detail: "The backend restored the previous state and logged the reversal.",
      undoable: false,
      outcome: "success",
      relatedFileIds: event.relatedFileIds,
    });
    return clone(recovery);
  }

  async listActivity() {
    await delay(200);
    return clone(this.activity);
  }

  async getSettings() {
    await delay(150);
    return clone(this.settings);
  }

  async saveSettings(next: WorkspaceSettings) {
    await delay(320);
    this.settings = clone(next);
    this.log({
      kind: "analysis",
      title: "Settings updated",
      detail: `Workspace path, file types, or model configuration changed.`,
      undoable: false,
      outcome: "success",
    });
    return clone(this.settings);
  }

  async checkRuntime(): Promise<LocalRuntime> {
    await delay(950);
    this.runtime = { ...clone(seedRuntime), lastCheckedAt: new Date().toISOString() };
    return clone(this.runtime);
  }

  async startScan(options: ScanOptions): Promise<AnalysisRun> {
    if (this.currentRun && this.currentRun.state === "running") {
      throw new Error("An analysis is already running.");
    }
    const totalFiles = this.files.length;
    const run: AnalysisRun = {
      id: `run-${Date.now()}`,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      state: "running",
      stages: seedAnalysisStages(totalFiles),
      filesAnalyzed: 0,
      errors: [],
    };
    this.currentRun = run;
    this.log({
      kind: "scan",
      title: "Analysis started",
      detail: `Workspace '${this.settings.workspaceName}' · ${this.files.length} files discovered · ${options.rescanAll ? "full rescan" : "incremental scan"}.`,
      undoable: false,
      outcome: "success",
    });

    const clearTimers = () => {
      this.timers.forEach(clearTimeout);
      this.timers = [];
    };
    clearTimers();

    const stageAt = (i: number) => run.stages[i];
    const step = (stageIndex: number, from: number, to: number, atMs: number, done?: () => void) => {
      this.timers.push(
        setTimeout(() => {
          const stage = stageAt(stageIndex);
          stage.state = "running";
          stage.processed = to;
          if (to >= stage.total) {
            stage.state = "done";
            done?.();
          }
        }, atMs),
      );
    };

    // Simulated pipeline. One file (the OCR-less scan) errors in extraction.
    step(0, 0, totalFiles, 500);
    step(1, 0, totalFiles - 1, 1400, () => {
      run.errors.push({
        fileId: "f-13",
        fileName: "scan_2026-03-14_1132.pdf",
        message: "No text layer — enable OCR to include scanned documents.",
      });
    });
    step(2, 0, totalFiles - 2, 2600, () => {
      const pendingFile = this.files.find((f) => f.status === "pending");
      if (pendingFile) {
        pendingFile.status = "analyzed";
        pendingFile.category = "Personal";
        pendingFile.summary = "Inventory of photo backups across two drives and one cloud bucket, with folder sizes and last-verified dates.";
        pendingFile.topics = ["Backups", "Photos"];
        pendingFile.keywords = ["backup", "inventory"];
      }
    });
    step(3, 0, run.stages[3].total, 3400);
    step(4, 0, run.stages[4].total, 4200);
    step(5, 0, run.stages[5].total, 5000, () => {
      run.state = "completed";
      run.finishedAt = new Date().toISOString();
      run.filesAnalyzed = this.files.filter((f) => f.status === "analyzed").length;

      // A newly discovered relationship + task + recommendations, so the scan visibly changes the workspace.
      this.relationships.unshift({
        id: `rel-${Date.now()}`,
        sourceFileId: "f-17",
        targetFileId: "f-16",
        similarity: 0.61,
        rationale: "Both list personal maintenance chores; the inventory references the backlog's backup item.",
        discoveredAt: new Date().toISOString(),
      });
      const source = this.files.find((f) => f.id === "f-17");
      if (source) {
        this.actionItems.unshift({
          id: `a-${Date.now()}`,
          title: "Verify the cloud photo backup before December",
          sourceFileId: "f-17",
          evidence: {
            fileId: "f-17",
            fileName: source.name,
            excerpt: "TODO: verify cloud bucket restore before December",
            location: "line 9",
          },
          dueDate: new Date(Date.now() + 38 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          dateCertainty: "inferred",
          confidence: 0.72,
          status: "new",
          discoveredAt: new Date().toISOString(),
        });
        this.recommendations.unshift({
          id: `r-${Date.now()}`,
          kind: "archive",
          title: "Archive the old backup inventory",
          current: "Misc/photo-backup-inventory.md",
          proposed: "Archive/2026/photo-backup-inventory.md",
          rationale: "The inventory describes a backup completed last year; the note itself suggests archiving after verification.",
          evidence: [
            { fileId: "f-17", fileName: source.name, excerpt: "verify cloud bucket restore before December", location: "line 9" },
          ],
          risk: "low",
          confidence: 0.75,
          status: "pending",
          createdAt: new Date().toISOString(),
          undoable: true,
        });
      }

      this.log({
        kind: "scan",
        title: "Analysis completed",
        detail: `${run.filesAnalyzed} of ${totalFiles} files analysed · ${run.errors.length} extraction error · 1 new relationship, 1 new task and 1 new suggestion prepared for review.`,
        undoable: false,
        outcome: run.errors.length ? "partial" : "success",
      });
    });

    return clone(run);
  }

  async getAnalysisRun(): Promise<AnalysisRun | null> {
    await delay(90);
    return this.currentRun ? clone(this.currentRun) : null;
  }

  watchAnalysisRun(
    _id: string,
    onUpdate: (run: AnalysisRun) => void,
    onError: (error: Error) => void,
  ): () => void {
    const timer = setInterval(() => {
      void this.getAnalysisRun()
        .then((run) => {
          if (run) {
            onUpdate(run);
            if (run.state !== "running") clearInterval(timer);
          }
        })
        .catch((error: unknown) => {
          clearInterval(timer);
          onError(error instanceof Error ? error : new Error("Could not read demo scan progress."));
        });
    }, 450);
    return () => clearInterval(timer);
  }
}

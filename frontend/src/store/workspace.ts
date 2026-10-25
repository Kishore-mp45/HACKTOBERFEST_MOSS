"use client";

/**
 * Moss workspace store (Zustand).
 *
 * Holds domain data loaded through the centralized API client plus the
 * analysis-run polling loop. UI-only state (search boxes, drawer open flags)
 * lives in the components that own it; everything multiple screens need to
 * agree on lives here.
 */

import { create } from "zustand";
import { mossApi, API_MODE, isDemoModeActive, setDemoModePreference } from "@/lib/api/client";
import { toast } from "@/hooks/use-toast";
import type {
  ActionItem,
  ActivityEvent,
  AnalysisRun,
  Collection,
  DuplicateGroup,
  LocalRuntime,
  OverviewSnapshot,
  Recommendation,
  WorkspaceFile,
  WorkspaceSettings,
} from "@/types/domain";

const ONBOARDED_KEY = "moss.onboarded";

function readOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOnboarded(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable — in-memory only */
  }
}

export type LoadStatus = "idle" | "loading" | "ready" | "error";

interface WorkspaceState {
  apiMode: "live" | "mock";

  /* Lifecycle */
  bootStatus: LoadStatus;
  bootError: string | null;
  onboarded: boolean;

  /* Domain data */
  overview: OverviewSnapshot | null;
  files: WorkspaceFile[];
  collections: Collection[];
  actionItems: ActionItem[];
  duplicates: DuplicateGroup[];
  recommendations: Recommendation[];
  activity: ActivityEvent[];
  settings: WorkspaceSettings | null;
  runtime: LocalRuntime | null;
  runtimeChecking: boolean;

  /* Analysis */
  analysisRun: AnalysisRun | null;
  scanStarting: boolean;
  scanDialogOpen: boolean;
  pollTimer: (() => void) | null;

  /* Mutations in flight — guards against double submissions */
  busyIds: string[];
  executingIds: string[];
  undoingIds: string[];

  /* Selection */
  selectedFileId: string | null;

  /* Actions */
  bootstrap: () => Promise<void>;
  setOnboarded: (value: boolean) => void;
  refreshAll: () => Promise<void>;
  startScan: (rescanAll: boolean) => Promise<void>;
  clearAnalysis: () => void;
  setScanDialogOpen: (open: boolean) => void;

  selectFile: (id: string | null) => void;

  confirmCollection: (id: string) => Promise<void>;
  dismissCollection: (id: string) => Promise<void>;

  setActionItemStatus: (id: string, status: ActionItem["status"]) => Promise<void>;

  setDuplicateStatus: (id: string, status: DuplicateGroup["status"]) => Promise<void>;

  editRecommendation: (id: string, proposed: string) => Promise<void>;
  approveRecommendation: (id: string) => Promise<void>;
  approveRecommendations: (ids: string[]) => Promise<void>;
  rejectRecommendation: (id: string) => Promise<void>;
  executeRecommendation: (id: string) => Promise<Recommendation>;

  undoActivity: (operationId: string) => Promise<void>;

  saveSettings: (settings: WorkspaceSettings) => Promise<void>;
  checkRuntime: () => Promise<void>;
  setDemoMode: (enabled: boolean) => Promise<void>;
}

function withBusy(ids: string[], id: string, busy: boolean): string[] {
  return busy ? [...ids, id] : ids.filter((x) => x !== id);
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  apiMode: isDemoModeActive() ? "mock" : API_MODE,
  bootStatus: "idle",
  bootError: null,
  onboarded: false,

  overview: null,
  files: [],
  collections: [],
  actionItems: [],
  duplicates: [],
  recommendations: [],
  activity: [],
  settings: null,
  runtime: null,
  runtimeChecking: false,

  analysisRun: null,
  scanStarting: false,
  scanDialogOpen: false,
  pollTimer: null,

  busyIds: [],
  executingIds: [],
  undoingIds: [],

  selectedFileId: null,

  async bootstrap() {
    if (get().bootStatus === "loading") return;
    const currentMode = isDemoModeActive() ? "mock" : "live";
    set({ apiMode: currentMode, bootStatus: "loading", bootError: null, onboarded: readOnboarded() });
    try {
      await mossApi.ping();
      const [overview, files, collections, actionItems, duplicates, recommendations, activity, settings] =
        await Promise.all([
          mossApi.getOverview(),
          mossApi.listFiles(),
          mossApi.listCollections(),
          mossApi.listActionItems(),
          mossApi.listDuplicates(),
          mossApi.listRecommendations(),
          mossApi.listActivity(),
          mossApi.getSettings(),
        ]);
      set({
        overview,
        files,
        collections,
        actionItems,
        duplicates,
        recommendations,
        activity,
        settings,
        bootStatus: "ready",
      });
      void get()
        .checkRuntime()
        .catch((error: unknown) => {
          toast({
            title: "Could not check local AI",
            description: error instanceof Error ? error.message : "The runtime status request failed.",
            variant: "destructive",
          });
        });
    } catch (error) {
      set({
        bootStatus: "error",
        bootError:
          error instanceof Error
            ? error.message
            : "Could not reach the Moss backend. Check that the FastAPI server is running and try again.",
      });
    }
  },

  setOnboarded(value: boolean) {
    writeOnboarded(value);
    set({ onboarded: value });
  },

  async refreshAll() {
    try {
      const [overview, files, collections, actionItems, duplicates, recommendations, activity] =
        await Promise.all([
          mossApi.getOverview(),
          mossApi.listFiles(),
          mossApi.listCollections(),
          mossApi.listActionItems(),
          mossApi.listDuplicates(),
          mossApi.listRecommendations(),
          mossApi.listActivity(),
        ]);
      set({ overview, files, collections, actionItems, duplicates, recommendations, activity });
    } catch (error) {
      toast({
        title: "Could not refresh workspace data",
        description:
          error instanceof Error
            ? `${error.message} A recent change may have succeeded; retry the refresh to confirm the latest state.`
            : "A recent change may have succeeded; retry the refresh to confirm the latest state.",
        variant: "destructive",
      });
    }
  },

  async startScan(rescanAll: boolean) {
    if (get().scanStarting) return;
    if (get().analysisRun?.state === "running") return;
    set({ scanStarting: true, scanDialogOpen: true });
    try {
      const run = await mossApi.startScan({ rescanAll });
      set({ analysisRun: run, scanStarting: false });
      get().pollTimer?.();

      const applyRun = (current: AnalysisRun) => {
        set({ analysisRun: current });
        if (current.state === "running") return;
        get().pollTimer?.();
        set({ pollTimer: null });
        void get().refreshAll();
        toast({
          title: current.state === "completed" ? "Analysis completed" : "Analysis finished with errors",
          description:
            current.state === "completed"
              ? "New suggestions are waiting in the review queue."
              : `${current.errors.length} file(s) could not be processed. Details in the analysis panel.`,
        });
      };

      let stopWatching: (() => void) | null = null;
      const pollForCompletion = () => {
        const timer = setInterval(() => {
          void mossApi
            .getAnalysisRun(run.id)
            .then((current) => {
              if (current) applyRun(current);
            })
            .catch((error: unknown) => {
              clearInterval(timer);
              set({ pollTimer: null });
              toast({
                title: "Could not read scan status",
                description: error instanceof Error ? error.message : "The backend status request failed.",
                variant: "destructive",
              });
            });
        }, 1000);
        stopWatching = () => clearInterval(timer);
        set({ pollTimer: stopWatching });
      };

      stopWatching = mossApi.watchAnalysisRun(
        run.id,
        applyRun,
        (error) => {
          toast({
            title: "Live scan progress disconnected",
            description: `${error.message} Switching to status checks.`,
            variant: "destructive",
          });
          stopWatching?.();
          pollForCompletion();
        },
      );
      set({ pollTimer: stopWatching });
    } catch (error) {
      set({ scanStarting: false, scanDialogOpen: false });
      throw error;
    }
  },

  clearAnalysis() {
    const existing = get().pollTimer;
    existing?.();
    set({ pollTimer: null, analysisRun: null, scanDialogOpen: false });
  },

  setScanDialogOpen(open: boolean) {
    set({ scanDialogOpen: open });
  },

  selectFile(id) {
    set({ selectedFileId: id });
  },

  async confirmCollection(id) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.confirmCollection(id);
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async dismissCollection(id) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.dismissCollection(id);
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async setActionItemStatus(id, status) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.updateActionItem(id, status);
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async setDuplicateStatus(id, status) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.setDuplicateStatus(id, status);
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async editRecommendation(id, proposed) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.updateRecommendation(id, { proposed });
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async approveRecommendation(id) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.updateRecommendation(id, { status: "approved" });
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async approveRecommendations(ids) {
    set({ busyIds: [...new Set([...get().busyIds, ...ids])] });
    try {
      await mossApi.approveRecommendations(ids);
      await get().refreshAll();
    } finally {
      set({
        busyIds: ids.reduce(
          (busyIds, id) => withBusy(busyIds, id, false),
          get().busyIds,
        ),
      });
    }
  },

  async rejectRecommendation(id) {
    set({ busyIds: withBusy(get().busyIds, id, true) });
    try {
      await mossApi.updateRecommendation(id, { status: "rejected" });
      await get().refreshAll();
    } finally {
      set({ busyIds: withBusy(get().busyIds, id, false) });
    }
  },

  async executeRecommendation(id) {
    const existing = get().recommendations.find((r) => r.id === id);
    if (!existing) throw new Error("Recommendation not found. Refresh the review queue.");
    if (get().executingIds.includes(id)) return existing;
    set({ executingIds: withBusy(get().executingIds, id, true) });
    try {
      const result = await mossApi.executeRecommendation(id);
      set({
        recommendations: (await mossApi.listRecommendations()) as Recommendation[],
      });
      await get().refreshAll();
      if (result.status === "failed") {
        throw new Error(result.resultMessage ?? result.conflict ?? "The operation failed.");
      }
      return result;
    } finally {
      set({ executingIds: withBusy(get().executingIds, id, false) });
    }
  },

  async undoActivity(operationId) {
    if (get().undoingIds.includes(operationId)) return;
    set({ undoingIds: withBusy(get().undoingIds, operationId, true) });
    try {
      await mossApi.undoOperation(operationId);
      await get().refreshAll();
    } finally {
      set({ undoingIds: withBusy(get().undoingIds, operationId, false) });
    }
  },

  async saveSettings(next) {
    const saved = await mossApi.saveSettings(next);
    set({ settings: saved });
    await get().refreshAll();
  },

  async checkRuntime() {
    set({ runtimeChecking: true });
    try {
      const runtime = await mossApi.checkRuntime();
      set({ runtime });
    } finally {
      set({ runtimeChecking: false });
    }
  },

  async setDemoMode(enabled) {
    setDemoModePreference(enabled);
    set({ apiMode: enabled ? "mock" : "live" });
    await get().bootstrap();
  },
}));

"use client";

/**
 * Centralized API access for the Moss frontend.
 *
 * Provider selection:
 * - When Demo Mode is active (via localStorage "moss.demo_mode", "?demo=1" URL param,
 *   or NEXT_PUBLIC_MOSS_DEMO_MODE=true) → `MockMossApi` with instant synthetic fixtures
 *   and 5-second simulated multi-stage scan.
 * - Otherwise → `HttpMossApi` connecting to the local FastAPI backend (port 8765).
 *
 * Switching between Demo Mode and Live Mode is supported dynamically without
 * rebuild or server restart.
 */

import type { MossApi } from "@/types/domain";
import { HttpMossApi } from "./http";
import { MockMossApi } from "./mock";

const DEMO_STORAGE_KEY = "moss.demo_mode";

export function isDemoModeActive(): boolean {
  if (typeof window !== "undefined") {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("demo") === "1" || urlParams.get("demo") === "true") {
        return true;
      }
      if (urlParams.get("demo") === "0" || urlParams.get("demo") === "false") {
        return false;
      }
      const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (stored === "true" || stored === "1") return true;
      if (stored === "false" || stored === "0") return false;
    } catch {
      // storage unavailable
    }
  }
  return process.env.NEXT_PUBLIC_MOSS_DEMO_MODE === "true";
}

export function setDemoModePreference(enabled: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // storage unavailable
    }
  }
}

function resolveBackendUrl(raw?: string): string {
  if (!raw) return "http://127.0.0.1:8765";
  const trimmed = raw.trim();
  if (!trimmed) return "http://127.0.0.1:8765";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }
  return `https://${trimmed}`.replace(/\/+$/, "");
}

const backendUrl = resolveBackendUrl(process.env.NEXT_PUBLIC_MOSS_API_URL);

// Singletons for both providers
const mockProvider = new MockMossApi();
const httpProvider = new HttpMossApi(backendUrl);

export function getActiveMossProvider(): MossApi {
  return isDemoModeActive() ? mockProvider : httpProvider;
}

// Dynamic proxy so any call to mossApi resolves against the currently selected mode
export const mossApi: MossApi = new Proxy({} as MossApi, {
  get(_target, prop: string | symbol) {
    const provider = getActiveMossProvider();
    const value = Reflect.get(provider, prop as keyof MossApi);
    return typeof value === "function" ? value.bind(provider) : value;
  },
});

export const API_MODE: "live" | "mock" = isDemoModeActive() ? "mock" : "live";

export { MossApiError } from "./http";

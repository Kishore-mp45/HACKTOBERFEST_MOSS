"use client";

/**
 * Centralized API access for the Moss frontend.
 *
 * Provider selection:
 * - `NEXT_PUBLIC_MOSS_API_URL` set → live FastAPI backend (`HttpMossApi`).
 * - otherwise                      → local FastAPI backend on port 8765.
 * - explicit development demo opt-in → `MockMossApi`.
 *
 * Synthetic data is never selected in production.
 */

import type { MossApi } from "@/types/domain";
import { HttpMossApi } from "./http";
import { MockMossApi } from "./mock";

const configuredBackendUrl = process.env.NEXT_PUBLIC_MOSS_API_URL?.trim();
const demoModeRequested = process.env.NEXT_PUBLIC_MOSS_DEMO_MODE === "true";
const useDemoProvider =
  process.env.NODE_ENV !== "production" && !configuredBackendUrl && demoModeRequested;
const backendUrl = configuredBackendUrl || "http://127.0.0.1:8765";

export const API_MODE: "live" | "mock" = useDemoProvider ? "mock" : "live";

export const mossApi: MossApi = useDemoProvider
  ? new MockMossApi()
  : new HttpMossApi(backendUrl);

export { MossApiError } from "./http";

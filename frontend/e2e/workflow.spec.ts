import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";

const workspace = {
  name: "E2E Garden",
  root_path: "C:\\moss-e2e-workspace",
};

const files = [
  {
    id: "file-1",
    name: "notes.txt",
    path: "notes.txt",
    kind: "txt",
    size_bytes: 128,
    modified_at: "2026-10-01T12:00:00Z",
    status: "analyzed",
    category: "Planning",
    summary: "Project notes for the E2E workflow.",
    topics: ["Planning"],
    keywords: ["project"],
    suggested_name: null,
    suggested_folder: null,
    ocr_used: false,
    error_message: null,
  },
  {
    id: "file-2",
    name: "meeting.txt",
    path: "meeting.txt",
    kind: "txt",
    size_bytes: 96,
    modified_at: "2026-10-02T12:00:00Z",
    status: "analyzed",
    category: "Planning",
    summary: "Related meeting notes.",
    topics: ["Planning"],
    keywords: ["meeting"],
    suggested_name: null,
    suggested_folder: null,
    ocr_used: false,
    error_message: null,
  },
];

function recommendation(status: string) {
  return {
    id: "recommendation-1",
    file_id: "file-1",
    relative_path: "notes.txt",
    rec_type: "rename",
    explanation: "The filename can be clearer.",
    confidence: "HIGH",
    status,
    created_at: "2026-10-01T12:00:00Z",
    proposed_operation: {
      op_type: "RENAME",
      source_path: "notes.txt",
      dest_path: "Project-Notes.txt",
      new_name: "Project-Notes.txt",
    },
    result_message: status === "APPLIED" ? "Renamed successfully." : null,
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("workspace workflow uses the HTTP adapter from setup through undo", async ({ page }) => {
  const screenshotDirectory = resolve(process.cwd(), "..", "docs", "screenshots");
  await mkdir(screenshotDirectory, { recursive: true });
  let workspaceConfigured = false;
  let scanCompleted = false;
  let failScanQueue = false;
  let failOperation = false;
  let modelsAvailable = true;
  let recommendationStatus = "PENDING";
  let duplicateStatus = "OPEN";
  const duplicateDecisions: string[] = [];
  const activity: Record<string, unknown>[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => console.error("E2E page error:", error));

  await page.route("http://127.0.0.1:8765/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    requests.push(`${method} ${path}`);

    if (method === "GET" && path === "/api/health") {
      await json(route, { status: "ok" });
    } else if (method === "GET" && path === "/api/workspace") {
      await json(route, workspaceConfigured ? workspace : null);
    } else if (method === "POST" && path === "/api/workspace/configure") {
      workspaceConfigured = true;
      await json(route, workspace);
    } else if (method === "GET" && path === "/api/overview") {
      await json(route, {
        stats: {
          files_analyzed: scanCompleted ? files.length : 0,
          files_pending: 0,
          semantic_groups: 0,
          duplicate_candidates: 0,
          action_items: 1,
          pending_recommendations: recommendationStatus === "PENDING" ? 1 : 0,
          last_analyzed_at: "2026-10-01T12:00:00Z",
        },
        attention: [],
        recent_relationships: [],
        recent_activity: [],
      });
    } else if (method === "GET" && path === "/api/files") {
      await json(route, files);
    } else if (method === "GET" && path === "/api/collections") {
      await json(route, []);
    } else if (method === "GET" && path === "/api/actions") {
      await json(route, [
        {
          id: "action-1",
          file_id: "file-1",
          relative_path: "notes.txt",
          description: "Send the project update",
          source_text: "Send the project update by Friday.",
          date_hint: null,
          date_verified: false,
          confidence: "HIGH",
          extracted_at: "2026-10-01T12:00:00Z",
          status: "NEW",
        },
      ]);
    } else if (method === "GET" && path === "/api/duplicates") {
      await json(route, [
        {
          id: "duplicate-1",
          file_a_id: "file-1",
          file_a_path: "notes.txt",
          file_b_id: "file-2",
          file_b_path: "meeting.txt",
          duplicate_type: "NEAR_DUPLICATE",
          similarity_score: 0.91,
          status: duplicateStatus,
        },
      ]);
    } else if (method === "GET" && path === "/api/recommendations") {
      await json(route, [recommendation(recommendationStatus)]);
    } else if (method === "GET" && path === "/api/activity") {
      await json(route, activity);
    } else if (method === "GET" && path === "/api/health/model-status") {
      await json(route, {
        ollama_available: modelsAvailable,
        llm_model: "Qwen3:4b",
        llm_available: modelsAvailable,
        embedding_model: "nomic-embed-text:latest",
        embedding_available: modelsAvailable,
        error: modelsAvailable ? null : "The local Ollama service is unavailable.",
      });
    } else if (method === "POST" && path === "/api/jobs/scan") {
      if (failScanQueue) {
        await json(route, { detail: "The scan could not be queued. Try again." }, 503);
      } else {
        await json(
          route,
          {
            id: "job-1",
            status: "QUEUED",
            total_files: 0,
            processed_files: 0,
            error_log: [],
            started_at: "2026-10-24T12:00:00Z",
            finished_at: null,
          },
          202,
        );
      }
    } else if (method === "GET" && path === "/api/jobs/job-1/events") {
      scanCompleted = true;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body:
          'data: {"type":"progress","stage":"extraction","processed":2,"total":2,"current_file":"meeting.txt"}\n\n' +
          'data: {"type":"complete","processed_files":2,"errors":[]}\n\n',
      });
    } else if (method === "GET" && path === "/api/files/file-1/relationships") {
      await json(route, [
        {
          file_id: "file-2",
          relative_path: "meeting.txt",
          relationship_type: "RELATED",
          similarity_score: 0.91,
          cluster_id: null,
        },
      ]);
    } else if (method === "POST" && path === "/api/duplicates/duplicate-1/status") {
      const status = (request.postDataJSON() as { status: string }).status;
      duplicateDecisions.push(status);
      duplicateStatus = status.toUpperCase();
      await json(route, { id: "duplicate-1", status: duplicateStatus });
    } else if (method === "POST" && path === "/api/approvals/recommendation-1") {
      recommendationStatus = "APPROVED";
      await json(route, recommendation(recommendationStatus));
    } else if (method === "POST" && path === "/api/recommendations/recommendation-1/execute") {
      if (failOperation) {
        await json(route, { detail: "The source changed. No operation was performed." }, 409);
      } else {
        recommendationStatus = "APPLIED";
        activity.push({
          id: "activity-1",
          kind: "rename",
          title: "File renamed",
          detail: "Renamed successfully.",
          created_at: "2026-10-24T12:00:00Z",
          undoable: true,
          outcome: "success",
          related_file_ids: ["file-1"],
          undone: false,
          operation_id: "operation-1",
        });
        await json(route, recommendation(recommendationStatus));
      }
    } else if (method === "POST" && path === "/api/operations/operation-1/undo") {
      activity[0] = {
        ...activity[0],
        kind: "recovery",
        title: "File renamed",
        detail: "The file was restored to its previous path.",
        undoable: false,
        undone: true,
      };
      await json(route, activity[0]);
    } else {
      await json(route, { detail: `Unexpected E2E request: ${method} ${path}` }, 404);
    }
  });

  await page.goto("/#/app/onboarding");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({
    path: resolve(screenshotDirectory, "demo-01-workspace-setup.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start setup" }).click();
  await page.getByRole("button", { name: "Authorize workspace" }).click();
  await expect(page.getByRole("status")).toContainText("backend confirmed access");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip this step" }).click();
  await page.getByRole("button", { name: "Run first analysis" }).click();

  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Analysis completed" })).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotDirectory, "demo-02-analysis-complete.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByText("Local AI ready").first()).toBeVisible();

  await page.getByRole("link", { name: "Inbox" }).click();
  await page.getByRole("row", { name: "Open details for notes.txt" }).click();
  await page.getByRole("tab", { name: "Related" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Related" }).getByRole("button", { name: "Open meeting.txt" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Action Items" }).click();
  await expect(page.getByText("Send the project update")).toBeVisible();
  await expect(page.getByText("Uncertain", { exact: true })).toBeVisible();
  await expect(page.getByText("No certain date", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show evidence from the source document" }).click();
  await expect(page.getByText("Send the project update by Friday.")).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotDirectory, "demo-03-action-evidence.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Duplicates" }).click();
  await page.getByRole("tab", { name: /Near-duplicate/ }).click();
  await page.getByRole("button", { name: "Dismiss candidate" }).click();
  await expect(
    page.getByText("Candidate dismissed — both files stay untouched", { exact: true }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Show dismissed candidates" }).click();
  await expect(page.getByRole("button", { name: "Re-open for review" })).toBeVisible();
  await page.getByRole("button", { name: "Re-open for review" }).click();
  await expect(page.getByText("Candidate re-opened for review", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Review Queue" }).click();
  await page.screenshot({
    path: resolve(screenshotDirectory, "demo-04-review-queue.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Approve only" }).click();
  await expect(page.getByText("Approved.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await page.getByRole("button", { name: "Execute approved operation" }).click();
  await expect(page.getByText("Operation applied", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Activity" }).click();
  await expect(page.locator("#main").getByText("Renamed successfully.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo operation" }).click();
  await expect(page.getByText("Undone", { exact: true })).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotDirectory, "demo-05-operation-undone.png"),
    fullPage: true,
  });

  expect(requests).toContain("POST /api/workspace/configure");
  expect(requests).toContain("POST /api/jobs/scan");
  expect(requests).toContain("GET /api/jobs/job-1/events");
  expect(requests).toContain("POST /api/duplicates/duplicate-1/status");
  expect(duplicateDecisions).toEqual(["dismissed", "open"]);
  expect(requests).toContain("POST /api/approvals/recommendation-1");
  expect(requests).toContain("POST /api/recommendations/recommendation-1/execute");
  expect(requests).toContain("POST /api/operations/operation-1/undo");

  modelsAvailable = false;
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(page.getByText("The local Ollama service is unavailable.")).toBeVisible();

  failScanQueue = true;
  await page.getByRole("link", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Analyze workspace" }).click();
  await expect(page.getByText("Analysis could not start", { exact: true })).toBeVisible();
  await expect(
    page.getByText("The scan could not be queued. Try again.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  failOperation = true;
  recommendationStatus = "PENDING";
  await page.reload();
  await page.getByRole("link", { name: "Review Queue" }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Approve only" }).click();
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await page.getByRole("button", { name: "Execute approved operation" }).click();
  await expect(page.getByText("Operation failed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("The source changed. No operation was performed.", { exact: true }),
  ).toBeVisible();
});

/**
 * Synthetic demo fixtures for Moss.
 *
 * ⚠️ Everything in `src/mocks/` is illustrative sample data. It exists so the
 * frontend can be developed, reviewed, and tested without a live FastAPI
 * backend or a local model. The UI renders a visible "Demo data" marker
 * whenever this provider is active. Do not import from this folder in
 * production code paths outside `src/lib/api/mock.ts`.
 */

import type {
  ActionItem,
  ActivityEvent,
  AnalysisStage,
  Collection,
  DocumentRelationship,
  DuplicateGroup,
  Evidence,
  LocalRuntime,
  OverviewSnapshot,
  Recommendation,
  WorkspaceFile,
  WorkspaceSettings,
  WorkspaceStats,
} from "@/types/domain";

/** ISO timestamp offset by `days` (fractions allowed) from now, so demo due dates stay meaningful. */
export function iso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export const DEMO_WORKSPACE_PATH = "C:\\MOSS_HACKTOBERFEST\\demo_workspace";

/* ----------------------------- Files ------------------------------ */

export const seedFiles: WorkspaceFile[] = [
  {
    id: "f-01",
    name: "climate-paper-v3.pdf",
    path: "Research/climate-paper-v3.pdf",
    kind: "pdf",
    sizeBytes: 2_411_524,
    modifiedAt: iso(-12),
    status: "analyzed",
    category: "Research",
    summary:
      "Preprint of an urban climate study measuring heat-island effects across 14 European cities, with an open dataset and mitigation scenarios.",
    topics: ["Urban climate", "Heat islands", "Mitigation"],
    keywords: ["urban heat island", "EU cities", "scenario modelling", "open dataset"],
    suggestedName: "urban-heat-islands-eu-study-2026.pdf",
    suggestedFolder: "Research/Urban Climate/",
  },
  {
    id: "f-02",
    name: "climate-paper-v3 (1).pdf",
    path: "Downloads/climate-paper-v3 (1).pdf",
    kind: "pdf",
    sizeBytes: 2_411_524,
    modifiedAt: iso(-11),
    status: "analyzed",
    category: "Research",
    summary: "Byte-identical re-download of climate-paper-v3.pdf.",
    topics: ["Urban climate"],
    keywords: ["duplicate", "re-download"],
  },
  {
    id: "f-03",
    name: "annual-report-2024-final.pdf",
    path: "Finance/annual-report-2024-final.pdf",
    kind: "pdf",
    sizeBytes: 5_822_310,
    modifiedAt: iso(-40),
    status: "analyzed",
    category: "Finance",
    summary:
      "Compiled annual report: revenue by segment, cost structure, and auditor notes. Q3 expense totals reconcile with the accompanying spreadsheet.",
    topics: ["Annual report", "Auditing"],
    keywords: ["revenue", "segments", "audit"],
  },
  {
    id: "f-04",
    name: "annual-report-2024-final (copy).pdf",
    path: "Finance/annual-report-2024-final (copy).pdf",
    kind: "pdf",
    sizeBytes: 5_822_310,
    modifiedAt: iso(-39),
    status: "analyzed",
    category: "Finance",
    summary: "Byte-identical manual copy of annual-report-2024-final.pdf.",
    topics: ["Annual report"],
    keywords: ["duplicate", "copy"],
  },
  {
    id: "f-05",
    name: "thesis-ch3-urban-heat-draft.docx",
    path: "Thesis/thesis-ch3-urban-heat-draft.docx",
    kind: "docx",
    sizeBytes: 184_320,
    modifiedAt: iso(-6),
    status: "analyzed",
    category: "Research",
    summary:
      "Draft of thesis chapter 3 on urban heat islands. Builds on the EU study dataset; sections 3.2 and 3.4 still marked as TODO.",
    topics: ["Thesis", "Urban climate"],
    keywords: ["chapter 3", "methodology", "TODO"],
    suggestedName: "thesis-ch3-urban-heat-draft-v2.docx",
  },
  {
    id: "f-06",
    name: "thesis-notes-ideas.md",
    path: "Thesis/thesis-notes-ideas.md",
    kind: "md",
    sizeBytes: 9_412,
    modifiedAt: iso(-5),
    status: "analyzed",
    category: "Research",
    summary:
      "Working notes for the thesis: outline for chapter 3, open questions about dataset normalisation, and reminders to email the supervisor.",
    topics: ["Thesis", "Notes"],
    keywords: ["outline", "open questions", "supervisor"],
  },
  {
    id: "f-07",
    name: "meeting-notes-2025-06-12.md",
    path: "Work/meeting-notes-2025-06-12.md",
    kind: "md",
    sizeBytes: 6_880,
    modifiedAt: iso(-3),
    status: "analyzed",
    category: "Work",
    summary:
      "Team sync notes: budget revision for Q3, hiring update, and personal follow-ups captured at the end.",
    topics: ["Meetings", "Budget"],
    keywords: ["action items", "Q3", "budget"],
  },
  {
    id: "f-08",
    name: "lease-agreement-signed.pdf",
    path: "Apartment/lease-agreement-signed.pdf",
    kind: "pdf",
    sizeBytes: 986_204,
    modifiedAt: iso(-210),
    status: "analyzed",
    category: "Apartment",
    summary:
      "Signed rental contract for Bergmannstraße 12, including clause 4.2 on maintenance responsibilities and the notice period.",
    topics: ["Lease", "Contract"],
    keywords: ["rental", "clause 4.2", "notice period"],
  },
  {
    id: "f-09",
    name: "rent-invoice-2026-06.pdf",
    path: "Apartment/rent-invoice-2026-06.pdf",
    kind: "pdf",
    sizeBytes: 121_800,
    modifiedAt: iso(-130),
    status: "analyzed",
    category: "Apartment",
    summary: "Monthly rent invoice. References maintenance cost sharing defined in clause 4.2 of the lease.",
    topics: ["Invoice", "Rent"],
    keywords: ["invoice", "maintenance", "clause 4.2"],
  },
  {
    id: "f-10",
    name: "insurance-policy-home-2026.pdf",
    path: "Apartment/insurance-policy-home-2026.pdf",
    kind: "pdf",
    sizeBytes: 442_100,
    modifiedAt: iso(-160),
    status: "analyzed",
    category: "Apartment",
    summary:
      "Household insurance policy. Coverage runs until the renewal window in November; the insured address matches the leased apartment.",
    topics: ["Insurance"],
    keywords: ["policy", "renewal", "coverage"],
  },
  {
    id: "f-11",
    name: "flight-itinerary-BER-LIS.pdf",
    path: "Travel/flight-itinerary-BER-LIS.pdf",
    kind: "pdf",
    sizeBytes: 210_442,
    modifiedAt: iso(-9),
    status: "analyzed",
    category: "Travel",
    summary: "Outbound and return flights Berlin–Lisbon in November, booking reference and check-in details included.",
    topics: ["Travel", "Flights"],
    keywords: ["BER", "LIS", "check-in"],
  },
  {
    id: "f-12",
    name: "lisbon-stay-confirmation.pdf",
    path: "Travel/lisbon-stay-confirmation.pdf",
    kind: "pdf",
    sizeBytes: 88_610,
    modifiedAt: iso(-8),
    status: "analyzed",
    category: "Travel",
    summary: "Accommodation confirmation for the Lisbon trip with host contact details and arrival window.",
    topics: ["Travel", "Accommodation"],
    keywords: ["check-in", "host", "confirmation"],
  },
  {
    id: "f-13",
    name: "scan_2026-03-14_1132.pdf",
    path: "Downloads/scan_2026-03-14_1132.pdf",
    kind: "pdf",
    sizeBytes: 3_190_776,
    modifiedAt: iso(-220),
    status: "error",
    category: null,
    summary: null,
    topics: [],
    keywords: [],
    ocrUsed: false,
    errorMessage: "Text extraction failed: pages contain no text layer. Enable OCR in Settings to process scanned documents.",
  },
  {
    id: "f-14",
    name: "q3-expense-report-DRAFT-final2.xlsx",
    path: "Work/q3-expense-report-DRAFT-final2.xlsx",
    kind: "xlsx",
    sizeBytes: 64_412,
    modifiedAt: iso(-4),
    status: "analyzed",
    category: "Work",
    summary:
      "Expense workbook for Acme GmbH, Q3: travel, hardware, and software lines with approval column. Header sheet names the vendor and quarter.",
    topics: ["Expenses", "Q3"],
    keywords: ["Acme GmbH", "expenses", "approval"],
    suggestedName: "acme-q3-2026-expense-report.xlsx",
    suggestedFolder: "Work/Finance/",
  },
  {
    id: "f-15",
    name: "vendor-contract-acme.docx",
    path: "Work/vendor-contract-acme.docx",
    kind: "docx",
    sizeBytes: 156_112,
    modifiedAt: iso(-95),
    status: "analyzed",
    category: "Work",
    summary:
      "Frame contract with Acme GmbH for maintenance services. Term ended 30 September 2026; no renewal clause was triggered.",
    topics: ["Contract", "Vendor"],
    keywords: ["Acme", "term", "expired"],
  },
  {
    id: "f-16",
    name: "downloads-todo-backlog.txt",
    path: "Misc/downloads-todo-backlog.txt",
    kind: "txt",
    sizeBytes: 2_140,
    modifiedAt: iso(-60),
    status: "analyzed",
    category: "Personal",
    summary:
      "Loose personal backlog: renew library card, compare bike insurance, and file the warranty papers for the espresso machine.",
    topics: ["Backlog"],
    keywords: ["todo", "personal"],
  },
  {
    id: "f-17",
    name: "photo-backup-inventory.md",
    path: "Misc/photo-backup-inventory.md",
    kind: "md",
    sizeBytes: 12_236,
    modifiedAt: iso(-1),
    status: "pending",
    category: null,
    summary: null,
    topics: [],
    keywords: [],
  },
  {
    id: "f-18",
    name: "thesis-ch3-draft-old.docx",
    path: "Thesis/old/thesis-ch3-draft-old.docx",
    kind: "docx",
    sizeBytes: 171_004,
    modifiedAt: iso(-48),
    status: "analyzed",
    category: "Research",
    summary:
      "Earlier revision of thesis chapter 3. Wording differs in roughly 9% of paragraphs; figures are lower resolution.",
    topics: ["Thesis"],
    keywords: ["draft", "older revision"],
  },
];

/* ------------------------- Relationships -------------------------- */

export const seedRelationships: DocumentRelationship[] = [
  {
    id: "rel-1",
    sourceFileId: "f-01",
    targetFileId: "f-05",
    similarity: 0.86,
    rationale: "Chapter 3 builds directly on the paper's urban-heat dataset and cites its methodology.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-2",
    sourceFileId: "f-05",
    targetFileId: "f-06",
    similarity: 0.83,
    rationale: "The notes outline the same chapter structure, including the TODO sections.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-3",
    sourceFileId: "f-01",
    targetFileId: "f-06",
    similarity: 0.74,
    rationale: "Notes reference the paper's normalisation approach for the EU city dataset.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-4",
    sourceFileId: "f-08",
    targetFileId: "f-09",
    similarity: 0.78,
    rationale: "The June invoice splits maintenance costs according to clause 4.2 of the lease.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-5",
    sourceFileId: "f-08",
    targetFileId: "f-10",
    similarity: 0.69,
    rationale: "The insured address on the policy matches the leased apartment.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-6",
    sourceFileId: "f-11",
    targetFileId: "f-12",
    similarity: 0.72,
    rationale: "Both documents describe the same November trip to Lisbon.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-7",
    sourceFileId: "f-03",
    targetFileId: "f-14",
    similarity: 0.66,
    rationale: "Q3 expense lines feed the cost totals in the annual report.",
    discoveredAt: iso(-0.09),
  },
  {
    id: "rel-8",
    sourceFileId: "f-07",
    targetFileId: "f-14",
    similarity: 0.58,
    rationale: "Meeting notes reference the Q3 budget revision tracked in the workbook.",
    discoveredAt: iso(-0.09),
  },
];

/* --------------------------- Collections -------------------------- */

const ev = (fileId: string, excerpt: string, page?: number, location?: string): Evidence => {
  const file = seedFiles.find((f) => f.id === fileId)!;
  return { fileId, fileName: file.name, excerpt, page, location };
};

export const seedCollections: Collection[] = [
  {
    id: "c-1",
    name: "Thesis — Urban Climate Research",
    description:
      "The chapter draft, its working notes, and the underlying EU study form one research thread: the notes cite the paper's dataset, and the draft reuses its methodology section.",
    keywords: ["urban heat island", "thesis", "dataset", "methodology"],
    fileIds: ["f-01", "f-05", "f-06"],
    origin: "ai",
    createdAt: iso(-0.09),
    evidence: [
      ev("f-06", "Ch.3 outline — reuse the normalisation approach from the EU heat-island study", undefined, "lines 14–22"),
      ev("f-05", "3.2 Methodology: adapted from the open EU dataset (see climate-paper-v3).", undefined, "§3.2"),
    ],
  },
  {
    id: "c-2",
    name: "Apartment & Lease",
    description:
      "Lease, rent invoices, and household insurance belong together: the invoice references clause 4.2 of the lease and the policy covers the same address.",
    keywords: ["lease", "rent", "insurance", "clause 4.2"],
    fileIds: ["f-08", "f-09", "f-10"],
    origin: "confirmed",
    createdAt: iso(-2),
    evidence: [
      ev("f-09", "Maintenance costs are shared per clause 4.2 of the rental contract.", 1),
      ev("f-10", "Insured location: Bergmannstraße 12, 10961 Berlin.", 2),
    ],
  },
  {
    id: "c-3",
    name: "Trip to Lisbon",
    description:
      "Flights and accommodation for the same November trip; both mention overlapping dates and the same traveller.",
    keywords: ["Lisbon", "flights", "accommodation"],
    fileIds: ["f-11", "f-12"],
    origin: "ai",
    createdAt: iso(-0.09),
    evidence: [
      ev("f-11", "Return: LIS → BER, 9 November.", 1),
      ev("f-12", "Stay: 2–9 November, host contact inside.", 1),
    ],
  },
  {
    id: "c-4",
    name: "Finance & Reports",
    description:
      "The annual report consolidates figures that originate in the Q3 expense workbook; both were classified under Finance.",
    keywords: ["annual report", "expenses", "Q3"],
    fileIds: ["f-03", "f-14"],
    origin: "ai",
    createdAt: iso(-0.09),
    evidence: [ev("f-14", "Q3 totals carried into FY summary (see annual report, cost structure).", 1)],
  },
];

/* --------------------------- Action items ------------------------- */

export const seedActionItems: ActionItem[] = [
  {
    id: "a-1",
    title: "Send the revised Q3 budget to Anja",
    sourceFileId: "f-07",
    evidence: ev("f-07", "TODO: send revised Q3 budget to Anja before Monday", undefined, "lines 31–32"),
    dueDate: iso(3),
    dateCertainty: "explicit",
    confidence: 0.94,
    status: "new",
    discoveredAt: iso(-0.09),
  },
  {
    id: "a-2",
    title: "Book a dentist appointment",
    sourceFileId: "f-07",
    evidence: ev("f-07", "Personal: finally book that dentist appointment", undefined, "line 35"),
    dueDate: null,
    dateCertainty: "uncertain",
    confidence: 0.71,
    status: "new",
    discoveredAt: iso(-0.09),
  },
  {
    id: "a-3",
    title: "Check in for flight BER → LIS (seat selection closes)",
    sourceFileId: "f-11",
    evidence: ev("f-11", "Online check-in opens 48h before departure. Seat selection closes at check-in.", 1),
    dueDate: iso(2),
    dateCertainty: "explicit",
    confidence: 0.97,
    status: "verified",
    discoveredAt: iso(-0.09),
  },
  {
    id: "a-4",
    title: "Decide on household insurance renewal",
    sourceFileId: "f-10",
    evidence: ev("f-10", "Coverage ends 15 November. Renewal notice should be given two weeks in advance.", 4),
    dueDate: iso(15),
    dateCertainty: "inferred",
    confidence: 0.82,
    status: "new",
    discoveredAt: iso(-0.09),
  },
  {
    id: "a-5",
    title: "Renew library card",
    sourceFileId: "f-16",
    evidence: ev("f-16", "- renew library card (check fees first)", undefined, "line 2"),
    dueDate: null,
    dateCertainty: "uncertain",
    confidence: 0.63,
    status: "dismissed",
    discoveredAt: iso(-2.6),
  },
  {
    id: "a-6",
    title: "Confirm arrival window with the Lisbon host",
    sourceFileId: "f-12",
    evidence: ev("f-12", "Please confirm your arrival window at least 48 hours in advance.", 1),
    dueDate: iso(5),
    dateCertainty: "inferred",
    confidence: 0.77,
    status: "new",
    discoveredAt: iso(-0.09),
  },
];

/* ---------------------------- Duplicates -------------------------- */

export const seedDuplicates: DuplicateGroup[] = [
  {
    id: "d-1",
    kind: "exact",
    method: "SHA-256 identical",
    fileIds: ["f-01", "f-02"],
    similarity: 1,
    reason: "Byte-identical files — a re-download saved under a numbered name.",
    discoveredAt: iso(-0.09),
    status: "open",
  },
  {
    id: "d-2",
    kind: "exact",
    method: "SHA-256 identical",
    fileIds: ["f-03", "f-04"],
    similarity: 1,
    reason: "Byte-identical files — one is a manual '(copy)' duplicate.",
    discoveredAt: iso(-0.09),
    status: "open",
  },
  {
    id: "d-3",
    kind: "near",
    method: "Word-level similarity 91%",
    fileIds: ["f-05", "f-18"],
    similarity: 0.91,
    reason: "Same document, different revisions: wording differs in ~9% of paragraphs and the figures have different resolutions.",
    discoveredAt: iso(-0.09),
    status: "open",
  },
  {
    id: "d-4",
    kind: "semantic",
    method: "Embedding cosine similarity 0.72",
    fileIds: ["f-11", "f-12"],
    similarity: 0.72,
    reason: "Not duplicates — both documents describe the Lisbon trip and may be worth keeping together.",
    discoveredAt: iso(-0.09),
    status: "open",
  },
];

/* -------------------------- Recommendations ----------------------- */

export const seedRecommendations: Recommendation[] = [
  {
    id: "r-1",
    kind: "rename",
    title: "Rename the Q3 expense workbook",
    current: "q3-expense-report-DRAFT-final2.xlsx",
    proposed: "acme-q3-2026-expense-report.xlsx",
    rationale:
      "The workbook's header sheet names the vendor (Acme GmbH) and the period (Q3 2026). A content-derived name removes the ambiguous 'DRAFT-final2' suffix.",
    evidence: [ev("f-14", "Acme GmbH — Expense Report, Q3 2026 (sheet 'Header', cell B2)")],
    risk: "low",
    confidence: 0.88,
    status: "pending",
    createdAt: iso(-0.09),
    undoable: true,
  },
  {
    id: "r-2",
    kind: "rename",
    title: "Rename the scanned receipt by its content",
    current: "scan_2026-03-14_1132.pdf",
    proposed: "receipt-hardware-store-2026-03-14.pdf",
    rationale:
      "The scanner default name says nothing about content. The receipt's merchant line ('Baumarkt Hirsch') and date support a searchable name. Requires OCR — currently failing for this file.",
    evidence: [ev("f-13", "[OCR pending — text layer missing. Proposal based on file metadata only.]")],
    risk: "medium",
    confidence: 0.62,
    status: "pending",
    createdAt: iso(-0.09),
    undoable: true,
  },
  {
    id: "r-3",
    kind: "move",
    title: "Move thesis notes next to the draft",
    current: "Thesis/thesis-notes-ideas.md",
    proposed: "Research/Urban Climate/thesis-notes-ideas.md",
    rationale:
      "The notes are part of the 'Thesis — Urban Climate Research' thread together with the draft and the paper. A shared folder keeps the thread in one place. The destination folder does not exist yet and would be created.",
    evidence: [ev("f-06", "Ch.3 outline — reuse the normalisation approach from the EU heat-island study")],
    risk: "medium",
    confidence: 0.81,
    status: "pending",
    createdAt: iso(-0.09),
    undoable: true,
  },
  {
    id: "r-4",
    kind: "collection",
    title: "Create collection 'Receipts & Invoices'",
    current: "—",
    proposed: "Receipts & Invoices 2026 (3 files)",
    rationale:
      "The scanned receipt, the June rent invoice, and the Q3 expense workbook share invoice-like structure and financial vocabulary. Grouping them makes future expense reviews faster.",
    evidence: [
      ev("f-09", "Monthly rent invoice — total due 1,180.00 €", 1),
      ev("f-14", "Acme GmbH — Expense Report, Q3 2026"),
    ],
    risk: "low",
    confidence: 0.79,
    status: "pending",
    createdAt: iso(-0.09),
    undoable: false,
  },
  {
    id: "r-5",
    kind: "archive",
    title: "Archive the expired Acme contract",
    current: "Work/vendor-contract-acme.docx",
    proposed: "Archive/2026/vendor-contract-acme.docx",
    rationale:
      "The contract's term ended on 30 September 2026 and no renewal clause was triggered. Archiving keeps it retrievable without cluttering the active workspace.",
    evidence: [ev("f-15", "This Agreement terminates on 30 September 2026 unless extended in writing.", 3)],
    risk: "medium",
    confidence: 0.84,
    status: "pending",
    createdAt: iso(-0.09),
    undoable: true,
  },
  {
    id: "r-6",
    kind: "move",
    title: "Keep Lisbon documents together",
    current: "Travel/lisbon-stay-confirmation.pdf",
    proposed: "Travel/Lisbon-2026/lisbon-stay-confirmation.pdf",
    rationale:
      "The stay confirmation and the flight itinerary describe the same trip; a dedicated subfolder pairs them. The folder does not exist yet and would be created.",
    evidence: [ev("f-12", "Stay: 2–9 November, host contact inside.", 1)],
    risk: "low",
    confidence: 0.8,
    status: "pending",
    createdAt: iso(-0.09),
    undoable: true,
  },
  {
    id: "r-7",
    kind: "move",
    title: "Move rent invoices into their own folder",
    current: "Apartment/rent-invoice-2026-06.pdf",
    proposed: "Apartment/Invoices/rent-invoice-2026-06.pdf",
    rationale: "Groups recurring invoices under one folder alongside the lease.",
    evidence: [ev("f-09", "Monthly rent invoice — total due 1,180.00 €", 1)],
    risk: "low",
    confidence: 0.77,
    status: "failed",
    createdAt: iso(-1.1),
    conflict: "Destination 'Apartment/Invoices/' already contains a file with the same name.",
    undoable: false,
    resultMessage: "Operation aborted — nothing was changed. Choose a different destination or resolve the conflict.",
  },
  {
    id: "r-8",
    kind: "rename",
    title: "Label the duplicate paper copy",
    current: "climate-paper-v3 (1).pdf",
    proposed: "climate-paper-v3-copy.pdf",
    rationale: "Keeps the redundant copy but gives it an explicit, sortable name until you decide to remove it.",
    evidence: [ev("f-02", "Byte-identical re-download of climate-paper-v3.pdf.")],
    risk: "low",
    confidence: 0.9,
    status: "applied",
    createdAt: iso(-1.2),
    undoable: true,
    resultMessage: "Renamed on 2 Nov. Reversible for 30 days via Activity.",
  },
];

/* ----------------------------- Activity --------------------------- */

export const seedActivity: ActivityEvent[] = [
  {
    id: "ev-1",
    kind: "scan",
    title: "Analysis completed",
    detail: "17 of 18 files analysed · 8 relationships · 4 semantic groups · 6 recommendations prepared. 1 file failed text extraction.",
    createdAt: iso(-0.09),
    undoable: false,
    outcome: "partial",
  },
  {
    id: "ev-2",
    kind: "analysis",
    title: "Relationship discovery finished",
    detail: "8 links found between 9 documents, including the thesis thread and the lease cluster.",
    createdAt: iso(-0.1),
    undoable: false,
    outcome: "success",
  },
  {
    id: "ev-3",
    kind: "rename",
    title: "Renamed 'climate-paper-v3 (1).pdf' → 'climate-paper-v3-copy.pdf'",
    detail: "Approved from the review queue. Operation op-1002; reversible.",
    createdAt: iso(-1.2),
    undoable: true,
    operationId: "op-1002",
    outcome: "success",
    relatedFileIds: ["f-02"],
  },
  {
    id: "ev-4",
    kind: "move",
    title: "Move to 'Apartment/Invoices/' failed",
    detail: "Destination already contained a file with the same name. Nothing was changed.",
    createdAt: iso(-1.1),
    undoable: false,
    outcome: "failure",
    relatedFileIds: ["f-09"],
  },
  {
    id: "ev-5",
    kind: "dismissal",
    title: "Dismissed action item 'Renew library card'",
    detail: "Marked as not relevant. It can be re-discovered on the next scan of the source note.",
    createdAt: iso(-2.6),
    undoable: false,
    outcome: "success",
  },
  {
    id: "ev-6",
    kind: "scan",
    title: "Analysis started",
    detail: "Workspace 'Garden' · 18 files discovered · full rescan.",
    createdAt: iso(-0.11),
    undoable: false,
    outcome: "success",
  },
];

/* -------------------------- Settings & status --------------------- */

export const seedSettings: WorkspaceSettings = {
  workspacePath: DEMO_WORKSPACE_PATH,
  workspaceName: "Demo Workspace",
  includedTypes: ["pdf", "docx", "md", "txt", "xlsx", "csv", "image"],
  exclusions: ["node_modules", ".git", "~$*", "*.tmp"],
  modelId: "Qwen3:4b",
  allowTelemetry: false,
  keepCache: true,
};

export const seedRuntime: LocalRuntime = {
  provider: "Ollama (127.0.0.1:11434)",
  status: "available",
  modelId: "Qwen3:4b",
  detail: "Local Ollama runtime verified and ready (Qwen3:4b & nomic-embed-text).",
  lastCheckedAt: iso(-0.02),
};

export const seedStats: WorkspaceStats = {
  filesAnalyzed: seedFiles.filter((f) => f.status === "analyzed").length,
  filesPending: seedFiles.filter((f) => f.status === "pending").length,
  semanticGroups: seedCollections.length,
  duplicateCandidates: seedDuplicates.filter((d) => d.status === "open").length,
  actionItems: seedActionItems.filter((a) => a.status === "new" || a.status === "verified").length,
  pendingRecommendations: seedRecommendations.filter((r) => r.status === "pending").length,
  lastAnalyzedAt: iso(-0.09),
};

export function seedOverview(): OverviewSnapshot {
  return {
    stats: { ...seedStats },
    attention: [
      {
        fileId: "f-13",
        fileName: "scan_2026-03-14_1132.pdf",
        reason: "Text extraction failed — the PDF has no text layer. Enable OCR or review manually.",
        severity: "error",
      },
      {
        fileId: "f-17",
        fileName: "photo-backup-inventory.md",
        reason: "Waiting for analysis — run a scan to include it.",
        severity: "info",
      },
      {
        fileId: "f-04",
        fileName: "annual-report-2024-final (copy).pdf",
        reason: "Exact duplicate of annual-report-2024-final.pdf — review in Duplicates.",
        severity: "warning",
      },
    ],
    recentRelationships: seedRelationships.slice(0, 4),
    recentActivity: seedActivity.slice(0, 4),
  };
}

export function seedAnalysisStages(totalFiles: number): AnalysisStage[] {
  return [
    { id: "discovery", label: "File discovery", state: "pending", processed: 0, total: totalFiles },
    { id: "extraction", label: "Text extraction", state: "pending", processed: 0, total: totalFiles },
    { id: "analysis", label: "AI analysis", state: "pending", processed: 0, total: totalFiles },
    { id: "relationships", label: "Relationship discovery", state: "pending", processed: 0, total: 8 },
    { id: "tasks", label: "Task extraction", state: "pending", processed: 0, total: 6 },
    { id: "recommendations", label: "Recommendation generation", state: "pending", processed: 0, total: 6 },
  ];
}

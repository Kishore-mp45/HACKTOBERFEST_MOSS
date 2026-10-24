"""Measure Moss's extraction and unchanged-file cache without invoking local models."""

from __future__ import annotations

import asyncio
import ctypes
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from docx import Document

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from moss.config import Settings
from moss.database import create_database, initialize_database
from moss.models import Workspace
from moss.services.scanner_service import ScannerService

DOCUMENT_COUNT = 500


def peak_working_set_bytes() -> int:
    if os.name == "nt":
        from ctypes import wintypes

        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong),
                ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        get_current_process = kernel32.GetCurrentProcess
        get_current_process.restype = wintypes.HANDLE
        get_process_memory_info = psapi.GetProcessMemoryInfo
        get_process_memory_info.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(ProcessMemoryCounters),
            wintypes.DWORD,
        ]
        get_process_memory_info.restype = wintypes.BOOL
        succeeded = get_process_memory_info(
            get_current_process(), ctypes.byref(counters), counters.cb
        )
        if not succeeded:
            raise ctypes.WinError()
        return int(counters.PeakWorkingSetSize)

    resource = __import__("resource")
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(peak if sys.platform == "darwin" else peak * 1024)


async def benchmark(root: Path, database_path: Path) -> dict[str, Any]:
    root.mkdir()
    for index in range(DOCUMENT_COUNT):
        document = Document()
        document.add_paragraph(
            f"Synthetic project {index}: review the planning notes and coordinate "
            "the next milestone."
        )
        document.save(str(root / f"document-{index:04d}.docx"))

    settings = Settings(database_path=str(database_path))
    engine, session_factory = create_database(settings, database_path=database_path)
    await initialize_database(engine)
    try:
        async with session_factory() as session:
            workspace = Workspace(name="benchmark", root_path=str(root))
            session.add(workspace)
            await session.commit()
            await session.refresh(workspace)
            scanner = ScannerService(settings)

            started = time.perf_counter()
            first_scan = await scanner.scan_workspace(session, workspace)
            first_seconds = time.perf_counter() - started

            started = time.perf_counter()
            cached_scan = await scanner.scan_workspace(session, workspace)
            cached_seconds = time.perf_counter() - started

            return {
                "mode": "extraction-only; no LLM or embedding inference",
                "documents": DOCUMENT_COUNT,
                "first_scan_seconds": round(first_seconds, 4),
                "cached_scan_seconds": round(cached_seconds, 4),
                "cached_time_reduction_percent": round(
                    (1 - cached_seconds / first_seconds) * 100, 2
                )
                if first_seconds
                else 0,
                "first_scan_extracted": first_scan["extracted_files"],
                "cached_scan_cache_hits": cached_scan["cache_hits"],
                "peak_working_set_bytes": peak_working_set_bytes(),
                "errors": len(first_scan["errors"]) + len(cached_scan["errors"]),
            }
    finally:
        await engine.dispose()


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="moss-scan-benchmark-") as temporary:
        directory = Path(temporary)
        result = asyncio.run(
            benchmark(directory / "workspace", directory / "moss.db")
        )
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

"""Single-process asyncio queue for scan jobs."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from collections.abc import AsyncIterator, Callable
from typing import Any

from moss.ai.llm_service import LLMService
from moss.config import Settings
from moss.jobs.scan_job import run_scan_job

LOGGER = logging.getLogger(__name__)


class JobQueue:
    def __init__(
        self,
        settings: Settings,
        llm_service_factory: Callable[[], LLMService | None] | None = None,
    ) -> None:
        self.settings = settings
        self.llm_service_factory = llm_service_factory
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._events: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._event_condition = asyncio.Condition()
        self._worker: asyncio.Task[None] | None = None
        self._shutdown = asyncio.Event()
        self._job_lock = asyncio.Lock()
        self._queued_ids: set[str] = set()
        self._tasks: set[asyncio.Task[None]] = set()

    async def start(self) -> None:
        if self._worker is None or self._worker.done():
            self._shutdown.clear()
            self._worker = asyncio.create_task(self._run(), name="moss-job-queue")

    async def stop(self) -> None:
        self._shutdown.set()
        if self._worker is not None:
            await self._queue.put("")
            await self._worker
            self._worker = None
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    async def enqueue(self, job_id: str) -> None:
        async with self._job_lock:
            if job_id in self._queued_ids:
                raise ValueError(f"Job {job_id} has already been enqueued")
            self._queued_ids.add(job_id)
            await self._queue.put(job_id)

    async def publish(self, event: dict[str, Any]) -> None:
        job_id = event.get("job_id")
        if isinstance(job_id, str):
            async with self._event_condition:
                self._events[job_id].append(event)
                self._event_condition.notify_all()

    async def events(self, job_id: str) -> AsyncIterator[dict[str, Any]]:
        cursor = 0
        while True:
            async with self._event_condition:
                while cursor >= len(self._events[job_id]):
                    await self._event_condition.wait()
                event = self._events[job_id][cursor]
                cursor += 1
            yield event
            if event.get("type") in {"complete", "error"}:
                return

    async def _run(self) -> None:
        while True:
            job_id = await self._queue.get()
            if self._shutdown.is_set() and not job_id:
                self._queue.task_done()
                return
            if not job_id:
                self._queue.task_done()
                continue
            task = asyncio.create_task(
                run_scan_job(
                    self.settings,
                    job_id,
                    self.publish,
                    self.llm_service_factory,
                ),
                name=f"moss-scan-{job_id}",
            )
            self._tasks.add(task)
            task.add_done_callback(self._task_done)
            try:
                await task
            finally:
                self._queue.task_done()
                async with self._job_lock:
                    self._queued_ids.discard(job_id)

    def _task_done(self, task: asyncio.Task[None]) -> None:
        self._tasks.discard(task)
        if task.cancelled():
            return
        exception = task.exception()
        if exception is not None:
            LOGGER.error(
                "Unhandled scan job exception (%s)",
                type(exception).__name__,
            )

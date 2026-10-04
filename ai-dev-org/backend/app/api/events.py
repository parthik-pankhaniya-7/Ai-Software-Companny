"""In-process event pub/sub mechanism for ai-dev-org.

Provides project-scoped message broadcasting using asyncio.Queue and collections.defaultdict.
Operates purely in-memory in a single process without Redis.
"""

import asyncio
from collections import defaultdict
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Project ID -> list of active subscriber Queues
_subscribers: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)


def subscribe(project_id: str) -> asyncio.Queue[dict[str, Any]]:
    """Register a new subscriber queue for the specified project.

    Args:
        project_id: Target project identifier.

    Returns:
        asyncio.Queue: Queue that receives published events for this project.
    """
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    _subscribers[project_id].append(queue)
    logger.debug("Subscriber added for project %s (total: %d)", project_id, len(_subscribers[project_id]))
    return queue


def unsubscribe(project_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
    """Remove a subscriber queue from the specified project.

    Args:
        project_id: Target project identifier.
        queue: Active queue instance to remove.
    """
    if project_id in _subscribers and queue in _subscribers[project_id]:
        _subscribers[project_id].remove(queue)
        logger.debug("Subscriber removed for project %s (remaining: %d)", project_id, len(_subscribers[project_id]))
        if not _subscribers[project_id]:
            _subscribers.pop(project_id, None)


async def publish(project_id: str, event: dict[str, Any]) -> None:
    """Broadcast an event payload to all active subscriber queues for a project.

    Args:
        project_id: Target project identifier.
        event: Event payload dictionary to broadcast.
    """
    if project_id not in _subscribers:
        return

    queues = list(_subscribers[project_id])
    for q in queues:
        try:
            await q.put(event)
        except Exception as exc:
            logger.warning("Failed to put event into subscriber queue: %s", exc)

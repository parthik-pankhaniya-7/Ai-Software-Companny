"""Tests for backend/app/api/events.py."""

import asyncio
import pytest

from app.api import events


@pytest.mark.asyncio
async def test_subscribe_and_publish() -> None:
    """Test that multiple subscribers on the same project receive published events."""
    project_id = "proj-test-pubsub"

    q1 = events.subscribe(project_id)
    q2 = events.subscribe(project_id)

    event_payload = {"type": "agent_start", "agent": "cto", "data": "synthesizing"}
    await events.publish(project_id, event_payload)

    # Both queues should have received the event
    assert not q1.empty()
    assert not q2.empty()

    msg1 = await q1.get()
    msg2 = await q2.get()

    assert msg1 == event_payload
    assert msg2 == event_payload

    # Cleanup
    events.unsubscribe(project_id, q1)
    events.unsubscribe(project_id, q2)


@pytest.mark.asyncio
async def test_project_isolation() -> None:
    """Test that events are scoped strictly to their respective project."""
    q_a = events.subscribe("proj-A")
    q_b = events.subscribe("proj-B")

    event_a = {"event": "A"}
    await events.publish("proj-A", event_a)

    assert not q_a.empty()
    assert q_b.empty()

    received = await q_a.get()
    assert received == event_a

    events.unsubscribe("proj-A", q_a)
    events.unsubscribe("proj-B", q_b)


@pytest.mark.asyncio
async def test_unsubscribe() -> None:
    """Test that unsubscribed queues do not receive subsequent messages."""
    project_id = "proj-unsub"

    q = events.subscribe(project_id)
    await events.publish(project_id, {"msg": 1})
    assert q.qsize() == 1

    events.unsubscribe(project_id, q)
    await events.publish(project_id, {"msg": 2})

    # Queue size should still be 1 (didn't receive msg 2)
    assert q.qsize() == 1
    val = await q.get()
    assert val == {"msg": 1}

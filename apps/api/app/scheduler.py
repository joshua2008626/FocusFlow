"""Deterministic study scheduler. Produces a *proposal*; the user must approve it before anything is saved."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
import math

BLOCK_MIN, BLOCK_MAX = 25, 50

@dataclass
class Task:
    id: str
    title: str
    importance: int = 3          # 1-5
    deadline: datetime | None = None
    remaining_minutes: int = 30

@dataclass
class Block:
    task_id: str
    day: date
    minutes: int
    reason: str

@dataclass
class Plan:
    blocks: list[Block] = field(default_factory=list)
    unscheduled: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

def score(t: Task, now: datetime) -> float:
    hours = (t.deadline - now).total_seconds() / 3600 if t.deadline else math.inf
    urgency = 1.0 if hours <= 0 else (0.1 if hours == math.inf else math.exp(-hours / 72))
    return 0.6 * urgency + 0.4 * (t.importance - 1) / 4

def build_plan(tasks: list[Task], now: datetime, daily_minutes: dict[date, int]) -> Plan:
    """daily_minutes: free study minutes per day (already net of existing commitments).
    Greedy by score; a task may only use days up to its deadline. Overdue tasks go to the first day."""
    plan, free = Plan(), dict(daily_minutes)
    days = sorted(free)
    for t in sorted(tasks, key=lambda t: (-score(t, now), t.id)):
        left = t.remaining_minutes
        usable = [d for d in days if t.deadline is None or d <= t.deadline.date() or t.deadline < now]
        if t.deadline and t.deadline < now:
            usable = days[:1]
        for d in usable:
            while left > 0 and free[d] >= BLOCK_MIN:
                m = min(left, BLOCK_MAX, free[d])
                if m < BLOCK_MIN and left > m:
                    break
                why = "overdue, scheduled first" if t.deadline and t.deadline < now else \
                      f"due {t.deadline:%b %d}" if t.deadline else "no deadline; fills spare time"
                plan.blocks.append(Block(t.id, d, m, why)); free[d] -= m; left -= m
            if left <= 0:
                break
        if left > 0:
            plan.unscheduled.append({"task_id": t.id, "minutes_short": left,
                                     "reason": "not enough free study time before the deadline"})
    if plan.unscheduled:
        short = sum(u["minutes_short"] for u in plan.unscheduled)
        plan.warnings.append(f"Schedule is overloaded: {short} min cannot fit. Extend study hours or move deadlines.")
    return plan

def reschedule_missed(tasks: list[Task], logged: dict[str, int], now: datetime, daily_minutes: dict[date, int]) -> Plan:
    """After a missed session: subtract logged minutes, drop finished tasks, re-plan from remaining free time."""
    for t in tasks:
        t.remaining_minutes = max(0, t.remaining_minutes - logged.get(t.id, 0))
    return build_plan([t for t in tasks if t.remaining_minutes > 0], now, daily_minutes)

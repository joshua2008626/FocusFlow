"""Spaced-repetition revision recommendations."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta

INTERVALS_DAYS = {0: 1, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30}  # by confidence 0-5

@dataclass
class TopicState:
    id: str
    name: str
    confidence: int
    importance: int
    last_revised: datetime | None
    studied: bool = True
    needs_revision: bool = False
    exam_date: datetime | None = None

def recommend(topics: list[TopicState], now: datetime, limit: int = 10) -> list[dict]:
    out = []
    for t in topics:
        if not t.studied:
            continue
        interval = timedelta(days=INTERVALS_DAYS[t.confidence])
        if t.exam_date and 0 < (t.exam_date - now).days <= 14:
            interval = interval / 2  # revise more often close to an exam
        due = (t.last_revised or now - interval) + interval
        overdue_days = (now - due).total_seconds() / 86400
        if overdue_days < 0 and not t.needs_revision:
            continue
        s = max(overdue_days, 0) + t.importance * 0.5 + (5 - t.confidence) * 0.5 + (3 if t.needs_revision else 0)
        why = ["flagged as needing revision"] if t.needs_revision else []
        if overdue_days >= 0:
            why.append(f"due {overdue_days:.0f} day(s) ago at confidence {t.confidence}/5")
        if t.exam_date and 0 < (t.exam_date - now).days <= 14:
            why.append(f"exam in {(t.exam_date - now).days} days")
        out.append({"topic_id": t.id, "name": t.name, "score": round(s, 2), "reasons": why})
    return sorted(out, key=lambda r: -r["score"])[:limit]

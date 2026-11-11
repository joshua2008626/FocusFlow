from datetime import datetime, timedelta, date
from app.scheduler import Task, build_plan, reschedule_missed
from app.revision import TopicState, recommend

NOW = datetime(2026, 11, 10, 9, 0)
D = lambda n: (NOW + timedelta(days=n)).date()

def test_urgent_task_scheduled_before_relaxed_one():
    tasks = [Task("later", "L", 3, NOW + timedelta(days=9), 50), Task("soon", "S", 3, NOW + timedelta(days=1), 50)]
    p = build_plan(tasks, NOW, {D(0): 50, D(1): 50})
    assert p.blocks[0].task_id == "soon"

def test_never_schedules_after_deadline():
    p = build_plan([Task("a", "A", 3, NOW + timedelta(hours=20), 100)], NOW, {D(0): 50, D(1): 50, D(5): 200})
    assert all(b.day <= D(1) for b in p.blocks)

def test_overload_is_reported():
    p = build_plan([Task("a", "A", 5, NOW + timedelta(days=1), 500)], NOW, {D(0): 60, D(1): 60})
    assert p.unscheduled and p.warnings

def test_reschedule_subtracts_logged_time():
    p = reschedule_missed([Task("a", "A", 3, NOW + timedelta(days=3), 100)], {"a": 100}, NOW, {D(0): 100})
    assert p.blocks == []

def test_revision_prefers_low_confidence_and_overdue():
    ts = [TopicState("hi", "Hi", 5, 3, NOW - timedelta(days=2)), TopicState("lo", "Lo", 1, 3, NOW - timedelta(days=5))]
    r = recommend(ts, NOW)
    assert [x["topic_id"] for x in r] == ["lo"]

def test_exam_proximity_shortens_interval():
    t = TopicState("t", "T", 3, 3, NOW - timedelta(days=4), exam_date=NOW + timedelta(days=5))
    assert recommend([t], NOW)

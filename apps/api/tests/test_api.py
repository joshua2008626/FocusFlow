"""API tests. Require: pip install -r requirements.txt (fastapi, httpx, PyJWT). Run: pytest"""
import time, jwt
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient

SECRET = "test-secret"

def token(sub="user-1", exp=3600):
    return jwt.encode({"sub": sub, "aud": "authenticated", "exp": int(time.time()) + exp}, SECRET, algorithm="HS256")

def client(monkeypatch, **env):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    for k, v in env.items(): monkeypatch.setenv(k, v)
    from app import main
    main._hits.clear()
    return TestClient(main.app)

def test_health_reports_ai_unconfigured(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    assert client(monkeypatch).get("/health").json() == {"ok": True, "ai_configured": False}

def test_rejects_missing_and_bad_tokens(monkeypatch):
    c = client(monkeypatch); body = {"tasks": [], "daily_minutes": {}}
    assert c.post("/schedule/propose", json=body).status_code == 401
    assert c.post("/schedule/propose", json=body, headers={"Authorization": "Bearer nope"}).status_code == 401
    assert c.post("/schedule/propose", json=body, headers={"Authorization": f"Bearer {token(exp=-10)}"}).status_code == 401

def test_propose_returns_blocks_needing_approval(monkeypatch):
    c = client(monkeypatch); today = date.today().isoformat()
    r = c.post("/schedule/propose", headers={"Authorization": f"Bearer {token()}"},
               json={"tasks": [{"id": "a", "title": "A", "importance": 4, "remaining_minutes": 50}], "daily_minutes": {today: 120}})
    assert r.status_code == 200 and r.json()["requires_approval"] is True and r.json()["blocks"][0]["task_id"] == "a"

def test_ai_chat_not_configured_returns_503(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    r = client(monkeypatch).post("/ai/chat", json={"message": "hi"}, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 503 and "not configured" in r.json()["detail"]

def test_ai_chat_validates_input_and_rate_limits(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    c = client(monkeypatch); h = {"Authorization": f"Bearer {token()}"}
    assert c.post("/ai/chat", json={"message": ""}, headers=h).status_code == 422
    assert c.post("/ai/chat", json={"message": "x" * 2001}, headers=h).status_code == 422
    codes = [c.post("/ai/chat", json={"message": "hi"}, headers=h).status_code for _ in range(12)]
    assert 429 in codes

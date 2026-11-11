"""FocusFlow API. Verifies Supabase JWTs, validates input, rate-limits, proxies AI server-side."""
import os, time, collections
from datetime import datetime, date
import httpx, jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .scheduler import Task, build_plan, reschedule_missed

app = FastAPI(title="FocusFlow API")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
                   allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

def current_user(authorization: str = Header(default="")) -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(503, "Server is missing SUPABASE_JWT_SECRET.")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token.")
    try:
        claims = jwt.decode(authorization[7:], secret, algorithms=["HS256"], audience="authenticated")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token.")
    return claims["sub"]

_hits: dict[str, collections.deque] = collections.defaultdict(collections.deque)
def rate_limit(user: str = Depends(current_user), limit: int = int(os.getenv("AI_RATE_LIMIT_PER_MIN", "10"))) -> str:
    q, now = _hits[user], time.monotonic()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many requests. Try again in a minute.")
    q.append(now)
    return user

class TaskIn(BaseModel):
    id: str
    title: str = Field(max_length=200)
    importance: int = Field(3, ge=1, le=5)
    deadline: datetime | None = None
    remaining_minutes: int = Field(30, ge=0, le=6000)

class PlanIn(BaseModel):
    tasks: list[TaskIn] = Field(max_length=200)
    daily_minutes: dict[date, int]
    logged_minutes: dict[str, int] = {}

@app.get("/health")
def health():
    return {"ok": True, "ai_configured": bool(os.getenv("LLM_API_KEY"))}

@app.post("/schedule/propose")
def propose(body: PlanIn, user: str = Depends(current_user)):
    """Returns a proposal only. The client shows it and writes to `schedules` after user approval."""
    tasks = [Task(**t.model_dump()) for t in body.tasks]
    now = datetime.now().astimezone()
    plan = reschedule_missed(tasks, body.logged_minutes, now, body.daily_minutes) if body.logged_minutes \
        else build_plan(tasks, now, body.daily_minutes)
    return {"blocks": plan.blocks, "unscheduled": plan.unscheduled, "warnings": plan.warnings, "requires_approval": True}

class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context: dict = {}

@app.post("/ai/chat")
async def chat(body: ChatIn, user: str = Depends(rate_limit)):
    key, base = os.getenv("LLM_API_KEY"), os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    if not key:
        raise HTTPException(503, "Flow AI is not configured. Set LLM_API_KEY, LLM_MODEL (and LLM_BASE_URL) on the server.")
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{base}/chat/completions", headers={"Authorization": f"Bearer {key}"}, json={
                "model": os.getenv("LLM_MODEL", ""),
                "messages": [{"role": "system", "content": "You are Flow AI, a study-planning assistant. Explain and advise; never claim to have changed the user's schedule."},
                             {"role": "user", "content": f"Context: {body.context}\n\n{body.message}"}]})
            r.raise_for_status()
            return {"reply": r.json()["choices"][0]["message"]["content"]}
    except httpx.HTTPError:
        raise HTTPException(502, "The AI provider failed. Try again later.")

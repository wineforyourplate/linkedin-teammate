#input_type_name: EngageClockInput
#output_type_name: EngageClockResult
#function_name: engage_clock

"""Engage runs on the person's own clock. One cheap check every 15 minutes.

Two jobs, set separately on the Engage page, both off until switched on:
- Replies (cheap, frequent): every N hours in working hours, read back their comments and draft
  replies to people who commented on their posts or answered their comments.
- Finding (expensive): up to 3 runs a day, each with a time and a batch size.

This check answers one of four things:
- "post": comments they approved are waiting. They are claimed here (status "posting") and
  posted one by one by a single agent run, never in parallel.
- "find": one of their runs is due. It covers posts published since the last run (at most 18
  hours back, at least 3). The run is marked here, before the agent starts, so it never starts
  twice.
- "replies": the replies job is due.
- "skip": nothing to do. Only "post", "find" and "replies" wake the agent.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from lemma_sdk import FunctionContext
from pydantic import BaseModel

WINDOW = timedelta(minutes=15)  # matches the schedule's tick
FIND_STALE = timedelta(minutes=50)  # a find run that hasn't finished by then is treated as over
POST_STALE = timedelta(minutes=60)  # a comment still "posting" after this needs a human look
MAX_BACK = timedelta(hours=18)
MIN_BACK = timedelta(hours=3)
MAX_BATCH = 15


class EngageClockInput(BaseModel):
    pass


class EngageClockResult(BaseModel):
    action: str  # find | post | replies | skip
    reason: str
    run: str | None = None
    label: str | None = None
    size: int = 0
    since: str | None = None
    hours: float = 0
    ids: list[str] = []


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _rows(pod, table: str, limit: int = 200) -> list[dict]:
    return pod.records.list(table, limit=limit).to_dict().get("items") or []


async def engage_clock(ctx: FunctionContext, data: EngageClockInput) -> EngageClockResult:
    pod = ctx.pod
    now = datetime.now(timezone.utc)
    profiles = _rows(pod, "profile", 1)
    if not profiles or profiles[0].get("onboarding_step") != "done":
        return EngageClockResult(action="skip", reason="still onboarding")
    p = profiles[0]
    skill = next((s for s in _rows(pod, "skills", 50) if s.get("key") == "engage"), None)
    if not skill or skill.get("state") != "on":
        return EngageClockResult(action="skip", reason="engage is not on")
    settings = dict(skill.get("settings") or {})

    # Posting: one queue, one agent run at a time.
    engs = _rows(pod, "engagements", 1000)
    posting = [e for e in engs if e.get("status") == "posting"]
    fresh = False
    for e in posting:
        changed = _parse(e.get("updated_at")) or now
        if now - changed > POST_STALE:
            pod.table("engagements").update(e["id"], {
                "status": "failed",
                "error": "I may not have finished posting this one. Check it on LinkedIn before trying again.",
            })
        else:
            fresh = True
    if fresh:
        return EngageClockResult(action="skip", reason="a batch is being posted")
    running = _parse(settings.get("running_since"))
    if running and now - running < FIND_STALE:
        return EngageClockResult(action="skip", reason="a find run is in progress")

    if (settings.get("mode") or "approve") != "copy":
        approved = sorted((e for e in engs if e.get("status") == "approved"), key=lambda e: str(e.get("updated_at") or ""))
        if approved:
            ids = [e["id"] for e in approved[:MAX_BATCH]]
            for i in ids:
                pod.table("engagements").update(i, {"status": "posting", "error": None})
            return EngageClockResult(action="post", reason=f"{len(ids)} approved", ids=ids)

    # Finding: is one of their runs due?
    try:
        tz = ZoneInfo(p.get("timezone") or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    local = now.astimezone(tz)
    runs = list(settings.get("runs") or [])
    for i, run in enumerate(runs):
        if not run.get("on") or not run.get("time"):
            continue
        hh, mm = (str(run["time"]).split(":") + ["0"])[:2]
        start = local.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
        if not (start <= local < start + WINDOW):
            continue
        last = _parse(run.get("last_run_at"))
        if last and last.astimezone(tz).date() == local.date():
            continue
        prev = _parse(settings.get("last_run_at"))
        since = max(prev or now - MAX_BACK, now - MAX_BACK)
        if now - since < MIN_BACK:
            since = now - MIN_BACK
        stamp = now.isoformat()
        runs[i] = {**run, "last_run_at": stamp}
        settings.update({"runs": runs, "last_run_at": stamp, "running_since": stamp})
        pod.table("skills").update(skill["id"], {"settings": settings})
        return EngageClockResult(
            action="find",
            reason=f"{run.get('label') or 'run'} at {run['time']}",
            run=run.get("key") or f"r{i + 1}",
            label=run.get("label") or f"Run {i + 1}",
            size=max(1, min(int(run.get("size") or 10), MAX_BATCH)),
            since=since.isoformat(),
            hours=round((now - since).total_seconds() / 3600, 1),
        )

    # Replies: every N hours inside working hours.
    rep = dict(settings.get("replies") or {})
    if rep.get("on"):
        start_s, end_s = (str(p.get("working_hours") or "09:00-19:00").split("-") + ["19:00"])[:2]
        sh, sm = (start_s.split(":") + ["0"])[:2]
        eh, em = (end_s.split(":") + ["0"])[:2]
        open_at = local.replace(hour=int(sh), minute=int(sm), second=0, microsecond=0)
        close_at = local.replace(hour=int(eh), minute=int(em), second=0, microsecond=0)
        last = _parse(rep.get("last_run_at"))
        every = timedelta(hours=max(1, float(rep.get("every_hours") or 2)))
        if open_at <= local < close_at and (not last or now - last >= every - timedelta(minutes=5)):
            stamp = now.isoformat()
            settings["replies"] = {**rep, "last_run_at": stamp}
            settings["running_since"] = stamp
            pod.table("skills").update(skill["id"], {"settings": settings})
            return EngageClockResult(action="replies", reason=f"every {rep.get('every_hours') or 2}h")
    return EngageClockResult(action="skip", reason="nothing due")

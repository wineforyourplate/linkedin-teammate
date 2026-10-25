#input_type_name: NudgeClockInput
#output_type_name: NudgeClockResult
#function_name: nudge_clock

"""Is it time for today's nudge? One cheap check, every half hour.

The daily nudge is one message on weekdays, half an hour before the person's posts go out,
only when something is waiting, and never twice in a day. A schedule runs this check every
30 minutes; only a "nudge" answer wakes the agent to write and send the message. The day is
marked here, before the agent runs, so two ticks can never send two messages.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from lemma_sdk import FunctionContext
from pydantic import BaseModel


class NudgeClockInput(BaseModel):
    pass


class NudgeClockResult(BaseModel):
    action: str  # nudge | skip
    reason: str
    posts: int = 0
    replies: int = 0
    people: int = 0
    draft_id: str | None = None


def _parse(value) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _rows(pod, table: str) -> list[dict]:
    return pod.records.list(table, limit=200).to_dict().get("items") or []


async def nudge_clock(ctx: FunctionContext, data: NudgeClockInput) -> NudgeClockResult:
    pod = ctx.pod
    profiles = _rows(pod, "profile")
    if not profiles:
        return NudgeClockResult(action="skip", reason="no profile")
    p = profiles[0]
    if p.get("onboarding_step") != "done":
        return NudgeClockResult(action="skip", reason="still onboarding")
    if p.get("nudge_off"):
        return NudgeClockResult(action="skip", reason="nudge is off")
    now = datetime.now(timezone.utc)
    paused = _parse(p.get("nudge_paused_until"))
    if paused and paused > now:
        return NudgeClockResult(action="skip", reason="paused")

    try:
        tz = ZoneInfo(p.get("timezone") or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    local = now.astimezone(tz)
    if local.weekday() >= 5:
        return NudgeClockResult(action="skip", reason="weekend")
    hh, mm = (str(p.get("posting_time") or "08:30").split(":") + ["0"])[:2]
    post_at = local.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
    target = post_at - timedelta(minutes=30)
    if not (target <= local < target + timedelta(minutes=30)):
        return NudgeClockResult(action="skip", reason=f"not yet: nudge at {target:%H:%M}")
    today = local.date().isoformat()
    if p.get("nudged_on") == today:
        return NudgeClockResult(action="skip", reason="already sent today")

    drafts = [d for d in _rows(pod, "drafts") if d.get("status") == "ready"]
    replies = [e for e in _rows(pod, "engagements") if e.get("status") in ("proposed", "liked") and e.get("comment_draft")]
    people = [x for x in _rows(pod, "people") if x.get("stage") == "found"]
    if not (drafts or replies or people):
        return NudgeClockResult(action="skip", reason="nothing waiting")

    pod.table("profile").update(p["id"], {"nudged_on": today})
    drafts.sort(key=lambda d: str(d.get("created_at") or ""))
    return NudgeClockResult(
        action="nudge",
        reason="time, and something is waiting",
        posts=min(len(drafts), 3),
        replies=min(len(replies), 5),
        people=min(len(people), 5),
        draft_id=drafts[0]["id"] if drafts else None,
    )

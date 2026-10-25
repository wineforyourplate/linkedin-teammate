#input_type_name: HealthCheckInput
#output_type_name: HealthCheckResult
#function_name: health_check

"""Is anything broken that only the person can fix? A cheap check every two hours.

Two things stop the teammate quietly: the LinkedIn connection (Lemma marks it for reconnecting,
or it stops answering) and the LinkedIn browser (signed out, or LinkedIn asking the person to
prove it's them). This reads both and writes what it found to `profile.health`, which the app
turns into "Needs your help". It answers "help" when a problem is worth a message: told at most
once a day per problem, marked here before the agent runs so two ticks never send two messages.

The connection check reads the account's status first, which costs no call to LinkedIn. Once a
day, and in the three hours before an approved post is due, it also makes one real call (who am
I), the one LinkedIn always allows. It never tries any other LinkedIn operation: a refused one
can mark the whole connection for reconnecting.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from lemma_sdk import FunctionContext
from pydantic import BaseModel

LINKEDIN = "linkedin"
BROWSER_SKILLS = {"warm_up", "engage", "find_people", "connect", "follow_up"}
TELL_EVERY = timedelta(hours=24)
CALL_EVERY = timedelta(hours=20)
BEFORE_POST = timedelta(hours=3)
ERROR_GRACE = timedelta(hours=6)


class HealthCheckInput(BaseModel):
    force: bool = False


class HealthCheckResult(BaseModel):
    action: str  # help | ok
    reason: str
    linkedin: str  # ok | reconnect | missing | error | unused
    browser: str  # ok | signed_out | checkpoint | unused
    tell: list[str] = []
    next_post_at: str | None = None


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _plain(value: Any) -> Any:
    for name in ("to_dict", "model_dump"):
        fn = getattr(value, name, None)
        if callable(fn):
            return fn()
    return value


def _rows(pod, table: str) -> list[dict]:
    return pod.records.list(table, limit=200).to_dict().get("items") or []


def _account_state(pod) -> str | None:
    """What Lemma says about the LinkedIn account, without calling LinkedIn. None if unreadable."""
    try:
        res = _plain(pod.connectors.accounts.list(app=LINKEDIN, limit=20))
    except Exception:
        return None
    items = (res or {}).get("items") if isinstance(res, dict) else None
    if items is None:
        return None
    states = {str(_plain(a).get("status") or "").upper() for a in items if isinstance(_plain(a), dict)}
    if "CONNECTED" in states:
        return "ok"
    if states & {"REAUTH_REQUIRED", "DISCONNECTED"}:
        return "reconnect"
    return "missing"


def _call_state(pod) -> tuple[str, str | None]:
    """One real call LinkedIn always allows. Returns (state, detail)."""
    try:
        result = pod.connectors.execute(LINKEDIN, "LINKEDIN_GET_MY_INFO", {}).to_dict()
    except Exception as exc:
        code = str(getattr(exc, "code", "") or "")
        text = f"{code} {exc}".upper()
        if "REAUTH" in text or "UNAUTHORIZED" in text:
            return "reconnect", "LinkedIn asked to be reconnected"
        if "CONNECTION_REQUIRED" in text or "NEEDS_ACCOUNT" in text:
            return "missing", "No LinkedIn account is connected"
        return "error", str(exc)[:200]
    outcome = result.get("result", result) if isinstance(result, dict) else result
    if isinstance(outcome, dict) and outcome.get("successful") is False:
        return "error", str(outcome.get("error"))[:200]
    return "ok", None


def _moved(prev: dict, state: str, now: datetime) -> dict:
    """Keep `since` while the state holds; restart it when the state changes."""
    since = prev.get("since") if prev.get("state") == state else now.isoformat()
    return {"state": state, "since": since}


async def health_check(ctx: FunctionContext, data: HealthCheckInput) -> HealthCheckResult:
    pod = ctx.pod
    profiles = _rows(pod, "profile")
    if not profiles:
        return HealthCheckResult(action="ok", reason="no profile", linkedin="unused", browser="unused")
    p = profiles[0]
    now = datetime.now(timezone.utc)
    health = dict(p.get("health") or {})
    told = dict(health.get("told") or {})
    li_prev = dict(health.get("linkedin") or {})

    # the next approved post, which is what a broken connection would stop
    slots = (_parse(d.get("scheduled_for")) for d in _rows(pod, "drafts") if d.get("status") == "approved")
    due = sorted(t for t in slots if t and t > now - timedelta(hours=1))
    next_post = due[0] if due else None

    # the LinkedIn connection
    relied_on = bool(p.get("linkedin_api"))
    state = _account_state(pod)
    detail = None
    called_at = _parse(li_prev.get("called_at"))
    soon = bool(next_post and next_post - now < BEFORE_POST)
    want_call = data.force or not called_at or now - called_at > CALL_EVERY or (soon and now - called_at > timedelta(hours=1))
    if state in (None, "ok") and (relied_on or state == "ok") and want_call:
        state, detail = _call_state(pod)
        called_at = now
    if state is None:
        state = li_prev.get("state") or ("unknown" if relied_on else "unused")
    if state == "missing" and not relied_on:
        state = "unused"
    linkedin = {**_moved(li_prev, state, now), "checked_at": now.isoformat(), "called_at": called_at.isoformat() if called_at else None, "detail": detail}

    # the LinkedIn browser, as the last browser run left it
    skills = _rows(pod, "skills")
    browser_used = any(s.get("key") in BROWSER_SKILLS and s.get("state") in ("on", "needs_you", "setting_up") for s in skills)
    bstatus = p.get("browser_status") or "unknown"
    bstate = bstatus if browser_used and bstatus in ("signed_out", "checkpoint") else ("ok" if browser_used else "unused")
    browser = _moved(dict(health.get("browser") or {}), bstate, now)

    problems: list[str] = []
    if state in ("reconnect", "missing"):
        problems.append(f"linkedin:{state}")
    elif state == "error" and (_parse(linkedin["since"]) or now) < now - ERROR_GRACE:
        problems.append("linkedin:error")
    if bstate in ("signed_out", "checkpoint"):
        problems.append(f"browser:{bstate}")

    # tell them about what's new, in waking hours unless a post is about to need it
    try:
        tz = ZoneInfo(p.get("timezone") or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    awake = 8 <= now.astimezone(tz).hour < 21 or soon
    tell: list[str] = []
    if p.get("onboarding_step") == "done" and awake:
        for key in problems:
            last = _parse(told.get(key))
            if not last or now - last > TELL_EVERY:
                tell.append(key)
                told[key] = now.isoformat()
    told = {k: v for k, v in told.items() if k in problems}

    pod.table("profile").update(p["id"], {"health": {"linkedin": linkedin, "browser": browser, "told": told}})
    return HealthCheckResult(
        action="help" if tell else "ok",
        reason=", ".join(tell) if tell else (", ".join(problems) + " (already told)" if problems else "all fine"),
        linkedin=state,
        browser=bstate,
        tell=tell,
        next_post_at=next_post.isoformat() if next_post else None,
    )

#input_type_name: AllowanceInput
#output_type_name: AllowanceResult
#function_name: allowance

"""How much a skill may still do on LinkedIn today.

The one place the pacing rules live, so every browser skill shares one daily
budget instead of each assuming the whole day is theirs. It reads the caller's
own `activity` rows (what already happened today), the skill's caps and how long
it has been running, and answers: may I do N more of this action, and how many
page loads are left for everything.

Call it before a batch, and log every action you take to `activity` so the next
call sees it.

It also says no to anyone who doesn't hold the browser (see browser_lock): pass
the `owner` you took it as. Only one run is ever in the person's browser.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from lemma_sdk import FunctionContext
from pydantic import BaseModel

PAGE_LOADS_PER_DAY = 120
LIKES_PER_DAY = 30  # across every skill
COMMENTS_PER_DAY = 15  # only ones the person approved
COMMENTS_CEILING = 20  # what the person can raise it to, never more
CONNECT_PAUSE_AFTER = 20  # judge acceptance once this many invites are out


class AllowanceInput(BaseModel):
    skill: str
    action: str
    count: int = 1
    owner: str | None = None  # who you took the browser as (function_browser_lock)


class AllowanceResult(BaseModel):
    allowed: int
    cap: int
    used: int
    page_loads_left: int
    day: int
    reason: str


def _zone(name: str | None) -> ZoneInfo | timezone:
    try:
        return ZoneInfo(name or "UTC")
    except Exception:
        return timezone.utc


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _pick(seq: list[int], index: int) -> int:
    return int(seq[max(0, min(index, len(seq) - 1))]) if seq else 0


async def allowance(ctx: FunctionContext, data: AllowanceInput) -> AllowanceResult:
    pod = ctx.pod
    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    zone = _zone(profile.get("timezone"))
    now = datetime.now(timezone.utc)
    day_start = now.astimezone(zone).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

    def deny(reason: str, cap: int = 0, used: int = 0, left: int = 0, day: int = 0) -> AllowanceResult:
        return AllowanceResult(allowed=0, cap=cap, used=used, page_loads_left=left, day=day, reason=reason)

    if profile.get("browser_status") == "checkpoint":
        return deny("LinkedIn showed a checkpoint or warning. Everything pauses until the person signs in again.")
    lock = profile.get("browser_lock") or {}
    until = _parse(lock.get("until"))
    if not (data.owner and lock.get("owner") == data.owner and until and until > now):
        holder = lock.get("owner") if until and until > now else None
        return deny(
            f"the browser is in use by {holder}: stop and don't open LinkedIn" if holder
            else "take the browser first with function_browser_lock and pass the same owner here"
        )

    skill = next(
        (s for s in pod.records.list("skills", limit=50).to_dict()["items"] if s.get("key") == data.skill), None
    )
    if skill is None:
        return deny(f"no skill called {data.skill}")
    # Reading pages only spends the shared page budget, so a skill that hasn't started yet may read
    # (the first map of their world runs in onboarding, before engage is on). Acting needs it on, and
    # a skill that stopped for them (needs_you, paused) does nothing at all.
    reading_first = data.action == "page_load" and skill.get("state") in ("off", "recommended")
    if skill.get("state") not in ("on", "setting_up") and not reading_first:
        return deny(f"{data.skill} is {skill.get('state')}, not on")

    caps = skill.get("caps") or {}
    started = _parse(skill.get("started_at")) or now
    day = max(1, (now.astimezone(zone).date() - started.astimezone(zone).date()).days + 1)
    week = (day - 1) // 7

    # Softer restart after a pause: half for 3 days, three quarters to day 7.
    factor = 1.0
    resumed = _parse((skill.get("settings") or {}).get("resumed_at"))
    if resumed:
        since = (now - resumed).days
        factor = 0.5 if since < 3 else 0.75 if since < 7 else 1.0

    rows = pod.query(
        "select skill, action, count(*) as n, coalesce(sum(page_loads), 0) as pl "
        f"from activity where created_at >= '{day_start.isoformat()}' group by skill, action"
    ).to_dict()["items"]
    page_loads = sum(int(r.get("pl") or 0) for r in rows)
    left = max(0, PAGE_LOADS_PER_DAY - page_loads)

    def done(action: str, skill_key: str | None = None) -> int:
        return sum(int(r["n"]) for r in rows if r["action"] == action and (skill_key is None or r["skill"] == skill_key))

    action = data.action
    if action == "page_load":
        cap, used = PAGE_LOADS_PER_DAY, page_loads
    elif action == "like":
        own = _pick(caps.get("likes") or [], day - 1) if isinstance(caps.get("likes"), list) else int(caps.get("likes") or LIKES_PER_DAY)
        cap, used = min(own, LIKES_PER_DAY), done("like")
    elif action == "view_profile":
        if data.skill == "warm_up":
            cap = _pick(caps.get("profile_views") or [], day - 1)
        else:
            cap = int(caps.get("profiles_per_day") or 25)
        used = done("view_profile", data.skill)
    elif action == "accept_invite":
        cap, used = int(caps.get("accept_invites") or 10), done("accept_invite")
    elif action == "invite":
        cap = _pick(caps.get("ramp") or [5], week)
        used = done("invite")
        week_cap = _pick(caps.get("weekly") or [35], week)
        week_rows = pod.query(
            "select count(*) as n from activity where action = 'invite' "
            f"and created_at >= '{(now - timedelta(days=7)).isoformat()}'"
        ).to_dict()["items"]
        week_used = int((week_rows or [{}])[0].get("n") or 0)
        cap = min(cap, max(0, week_cap - week_used + used))
        people = pod.query(
            "select stage, count(*) as n from people where stage in ('invited','accepted','messaged','replied') group by stage"
        ).to_dict()["items"]
        sent = sum(int(p["n"]) for p in people)
        accepted = sum(int(p["n"]) for p in people if p["stage"] != "invited")
        pending = sum(int(p["n"]) for p in people if p["stage"] == "invited")
        if pending >= int(caps.get("max_pending") or 500):
            return deny("Too many invites are still pending. Withdraw stale ones first.", cap, used, left, day)
        if sent >= CONNECT_PAUSE_AFTER and accepted / max(1, sent) < float(caps.get("min_acceptance") or 0.3):
            return deny(
                f"Only {accepted} of {sent} invites were accepted (under 30%). Paused so the account stays healthy; "
                "tighten who we invite before sending more.",
                cap, used, left, day,
            )
    elif action == "message":
        cap, used = _pick(caps.get("ramp") or [3], week), done("message")
    elif action == "post":
        cap, used = int(caps.get("posts_per_day") or 1), done("post")
    elif action == "profile_edit":
        cap, used = int(caps.get("edits_per_day") or 5), done("profile_edit")
    elif action == "comment":
        # Only comments the person approved, posted one by one at a human pace.
        cap, used = min(int(caps.get("comments") or COMMENTS_PER_DAY), COMMENTS_CEILING), done("comment")
    else:
        cap, used = 999, done(action)

    cap = int(cap * factor)
    allowed = max(0, min(data.count, cap - used))
    if action != "page_load" and left <= 0:
        allowed = 0
    reason = (
        "ok" if allowed else
        "today's shared page budget is used up; postponed to tomorrow" if left <= 0 else
        f"today's cap of {cap} is reached; postponed to tomorrow"
    )
    return AllowanceResult(allowed=allowed, cap=cap, used=used, page_loads_left=left, day=day, reason=reason)

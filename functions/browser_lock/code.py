#input_type_name: BrowserLockInput
#output_type_name: BrowserLockResult
#function_name: browser_lock

"""One run at a time in the person's LinkedIn browser.

Every job that opens LinkedIn (publishing, engage, warm-up, finding people,
following up, reading their profile) takes the browser first and gives it back
when it's done. A run that finds it taken stops, or waits a little if it is
publishing, and never shares it. A lock carries an owner and an expiry, so a run
that died can't hold the browser forever.

On 26 Oct 2026 ten agents drove one browser at once: one typed a test string
into the composer while another clicked Post.

`take` writes the lock, waits a moment and reads it back: of two runs that took
it in the same instant, only the one whose write landed last keeps it.
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from lemma_sdk import FunctionContext
from pydantic import BaseModel

SETTLE = 1.5  # seconds between writing the lock and reading it back
MAX_MINUTES = 60


class BrowserLockInput(BaseModel):
    action: str  # take | release | renew | check
    owner: str  # who: the job and its run, e.g. "engage-find 2026-10-26 09:30"
    minutes: int = 20  # how long the job expects to need it


class BrowserLockResult(BaseModel):
    ok: bool
    reason: str
    owner: str | None = None  # who holds it now
    until: str | None = None


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def held_by_other(lock: dict | None, owner: str, now: datetime) -> bool:
    """A live lock someone else holds. Same rule in allowance, engage_clock and publish_guard."""
    until = _parse((lock or {}).get("until"))
    return bool(lock and lock.get("owner") and lock.get("owner") != owner and until and until > now)


async def browser_lock(ctx: FunctionContext, data: BrowserLockInput) -> BrowserLockResult:
    pod = ctx.pod
    profiles = pod.table("profile")
    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    if not profile.get("id"):
        return BrowserLockResult(ok=False, reason="no profile yet")
    now = datetime.now(timezone.utc)
    lock = profile.get("browser_lock") or None
    owner = (data.owner or "").strip()
    if not owner:
        return BrowserLockResult(ok=False, reason="say who you are: owner is empty")

    if data.action == "check":
        busy = held_by_other(lock, owner, now)
        return BrowserLockResult(ok=not busy, reason="in use" if busy else "free", owner=(lock or {}).get("owner") if busy else None, until=(lock or {}).get("until") if busy else None)

    if data.action == "release":
        if lock and lock.get("owner") == owner:
            profiles.update(profile["id"], {"browser_lock": None})
            return BrowserLockResult(ok=True, reason="released")
        return BrowserLockResult(ok=True, reason="not yours, nothing to release", owner=(lock or {}).get("owner"))

    if data.action not in ("take", "renew"):
        return BrowserLockResult(ok=False, reason=f"unknown action {data.action!r}")
    if held_by_other(lock, owner, now):
        return BrowserLockResult(ok=False, reason=f"the browser is in use by {lock['owner']}; don't open LinkedIn", owner=lock["owner"], until=lock.get("until"))
    if data.action == "renew" and not (lock and lock.get("owner") == owner):
        return BrowserLockResult(ok=False, reason="you don't hold the browser; take it first")

    until = (now + timedelta(minutes=max(1, min(MAX_MINUTES, data.minutes)))).isoformat()
    taken_at = lock.get("taken_at") if data.action == "renew" and lock else now.isoformat()
    profiles.update(profile["id"], {"browser_lock": {"owner": owner, "until": until, "taken_at": taken_at}})
    time.sleep(SETTLE)
    after = (profiles.get(profile["id"]).get("browser_lock") or {})
    if after.get("owner") != owner:
        return BrowserLockResult(ok=False, reason=f"{after.get('owner')} took the browser at the same moment; don't open LinkedIn", owner=after.get("owner"), until=after.get("until"))
    return BrowserLockResult(ok=True, reason="yours until " + until, owner=owner, until=until)

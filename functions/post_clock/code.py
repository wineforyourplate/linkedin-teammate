#input_type_name: PostClockInput
#output_type_name: PostClockResult
#function_name: post_clock

"""One tick of an approved post's clock: publish now, wait a little, wait an hour, or stop.

A workflow wait only takes a fixed number of seconds, so the publish run loops
tick → wait → tick until the slot arrives. Every tick re-reads the draft, so
editing or killing it stops the run, and a run started by an older approval
stops when the draft was approved again since (the newer approval has its own run).

On 26 Oct 2026 a failed publish wrote the draft back to `approved`, which started
another run, 11 times in 80 seconds; ten agents then fought over one browser and
a test string went out in place of the post. So, at the slot, in this order:

1. Only an approval starts a publish. A run whose trigger didn't set
   `approved_at` stops at once (the `on-approve` trigger already filters these).
2. Watchdog: if more than one live run exists for this approval, the oldest keeps
   it, cancels the others and tells the person once; any other run stops.
3. Claim: `approved` → `publishing` with this run's key, then read back. A run
   that doesn't find its own key stops. A body that changed since the approval
   fails the draft.
4. Route: the LinkedIn API for text, image and link posts when it's connected;
   the browser only for what the API can't post (carousel, poll, video) or when
   the person opted in (`skills.post.settings.browser_fallback`). Otherwise the
   post is held, and the person hears once what to do.
"""

import hashlib
import os
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from lemma_sdk import FunctionContext
from pydantic import BaseModel

PUBLISH_WITHIN = 120  # seconds: close enough to the slot
SHORT_WAIT_WITHIN = 75 * 60  # under this, check every 5 minutes
SETTLE = 1.5  # seconds between writing the claim and reading it back
API_FORMATS = ("text", "image", "link")
DONE_RUNS = ("COMPLETED", "FAILED", "CANCELLED", "FILTERED")


class PostClockInput(BaseModel):
    draft_id: str
    approved_at: str | None = None
    approved_body: str | None = None  # the body in the approving write
    trigger_operation: str | None = None  # INSERT | UPDATE
    trigger_changed: list[str] | None = None  # the columns the triggering write changed
    run_key: str | None = None  # start.metadata.fired_at: tells this run apart from any other


class PostClockResult(BaseModel):
    action: str  # publish | wait_short | wait_long | stop
    reason: str
    route: str | None = None  # api | browser, with publish
    format: str | None = None
    api: bool = False  # route == "api"; read by runs started before `route` existed
    tell: bool = False  # a message for the person is waiting in the draft: the workflow's tell step sends it
    seconds_left: int | None = None


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _same(a: Any, b: Any) -> bool:
    x, y = _parse(a), _parse(b)
    return bool(x and y and abs((x - y).total_seconds()) <= 1)


def body_sha(text: str) -> str:
    """Fingerprint of a post's text. Same in publish_api and publish_guard."""
    return hashlib.sha256((text or "").strip().encode("utf-8")).hexdigest()


def notify(ctx: FunctionContext, title: str, body: str) -> bool:
    """One message to the person, wherever they read them. Same in publish_api and publish_guard.

    The function runtime's SDK has no notifications client yet, so this calls the pod's
    notifications endpoint with the invocation's own token.
    """
    try:
        import httpx

        r = httpx.post(
            f"{os.environ['LEMMA_BASE_URL'].rstrip('/')}/pods/{os.environ['LEMMA_POD_ID']}/notifications",
            headers={"Authorization": f"Bearer {os.environ['LEMMA_TOKEN']}"},
            json={"recipient": str(ctx.user_id), "title": title, "body": body, "expects_response": False},
            timeout=20,
        )
        return r.status_code < 300
    except Exception:
        return False


def slot_text(value: Any, tz: str | None) -> str:
    dt = _parse(value)
    if not dt:
        return "next"
    try:
        dt = dt.astimezone(ZoneInfo(tz or "UTC"))
    except Exception:
        pass
    return dt.strftime("%a %H:%M")


def _live_runs(pod, draft_id: str, approved_at: Any) -> list[dict] | None:
    """Every run still going for this draft and this approval, oldest first. None when runs can't be read."""
    try:
        items = pod.workflows.runs("publish", limit=50).to_dict().get("items") or []
    except Exception:
        return None
    mine = []
    for r in items:
        if r.get("status") in DONE_RUNS:
            continue
        try:
            start = (pod.workflows.run_get(str(r["id"])).to_dict().get("execution_context") or {}).get("start") or {}
        except Exception:
            continue
        meta, payload = start.get("metadata") or {}, start.get("payload") or {}
        if meta.get("record_id") != draft_id or (approved_at and not _same(payload.get("approved_at"), approved_at)):
            continue
        mine.append({"id": str(r["id"]), "created_at": str(r.get("created_at") or ""), "key": meta.get("fired_at")})
    return sorted(mine, key=lambda r: r["created_at"])


def _watchdog(ctx: FunctionContext, drafts, draft: dict, run_key: str | None) -> tuple[str | None, bool]:
    """More than one run for one approval: the oldest cancels the rest and says so once.

    Returns (why this run must stop, whether a message is waiting for the tell step).
    """
    runs = _live_runs(ctx.pod, draft["id"], draft.get("approved_at"))
    if not runs or len(runs) < 2:
        return None, False
    keeper = runs[0]
    if run_key and keeper["key"] and keeper["key"] != run_key:
        return f"run {keeper['id']} already owns this post", False
    cancelled = []
    for r in runs[1:]:
        try:
            ctx.pod.workflows.cancel_run(r["id"])
            cancelled.append(r["id"])
        except Exception:
            pass
    results = dict(draft.get("results") or {})
    watch = dict(results.get("watchdog") or {})
    if watch.get("alerted_at"):
        return None, False
    title = draft.get("title") or (draft.get("body") or "")[:50]
    message = {"title": "I stopped a runaway publish",
               "body": f'{len(runs)} publish runs started for "{title[:50]}". I kept one, cancelled the rest, and nothing extra went out.'}
    sent = notify(ctx, message["title"], message["body"])
    now = datetime.now(timezone.utc).isoformat()
    results["watchdog"] = {"alerted_at": now, "runs": len(runs), "cancelled": cancelled, "told": now if sent else None, "message": None if sent else message}
    drafts.update(draft["id"], {"results": results})
    ctx.pod.table("activity").create({"skill": "post", "action": "check", "target": draft["id"], "result": "warning", "page_loads": 0,
                                      "detail": f'{len(runs)} publish runs for one post at once: kept the oldest, cancelled {len(cancelled)}.'})
    return None, not sent


def _claim(drafts, draft_id: str, approved_body: str | None, run_key: str) -> tuple[dict | None, str | None]:
    """Make the draft this run's to publish: approved → publishing with our key, then check it stuck."""
    draft = drafts.get(draft_id)
    if draft.get("status") != "approved":
        return None, f"draft is {draft.get('status')}, not approved"
    body = (draft.get("body") or "").strip()
    if approved_body is not None and body != approved_body.strip():
        drafts.update(draft_id, {"status": "failed", "error": "Not posted: the text changed after you approved it. Approve it again to post the new text."})
        return None, "the text changed after the approval"
    attempt = int(draft.get("attempts") or 0) + 1
    results = dict(draft.get("results") or {})
    results["publish"] = {
        "run": run_key,
        "attempt": attempt,
        "approved_at": draft.get("approved_at"),
        "body_sha": body_sha(body),
        "claimed_at": datetime.now(timezone.utc).isoformat(),
    }
    drafts.update(draft_id, {"status": "publishing", "error": None, "attempts": attempt, "results": results})
    time.sleep(SETTLE)
    after = drafts.get(draft_id)
    if ((after.get("results") or {}).get("publish") or {}).get("run") != run_key:
        return None, "another run claimed this draft"
    return after, None


def _route(profile: dict, post_skill: dict, fmt: str) -> tuple[str | None, str | None]:
    """(route, held): api or browser, or no route and why it's held."""
    if fmt not in API_FORMATS:
        return "browser", None  # only the browser can post a carousel, a poll or a video
    if profile.get("linkedin_api") and profile.get("linkedin_urn"):
        return "api", None
    if (post_skill.get("settings") or {}).get("browser_fallback"):
        return "browser", None
    return None, "connect"


def hold(ctx: FunctionContext, drafts, draft: dict, held: str, tz: str | None) -> bool:
    """Keep the post back until the person fixes LinkedIn, and tell them once. Same in publish_api.

    Returns True when the message is waiting for the workflow's tell step (sending from here failed).
    """
    title = draft.get("title") or (draft.get("body") or "")[:50]
    when = slot_text(draft.get("scheduled_for"), tz)
    verb = "Reconnect" if held == "reconnect" else "Connect"
    results = dict(draft.get("results") or {})
    check = dict(results.get("publish") or {})
    check["held"] = held
    pending = False
    if not check.get("told"):
        message = {"title": f"Your {when} post is waiting: {verb.lower()} LinkedIn",
                   "body": f'"{title[:60]}" is waiting: LinkedIn needs you to {verb.lower()} it. '
                           f"Open the app, tap {verb} on Home (30 seconds), then open the post and schedule it again. Nothing has gone out."}
        if notify(ctx, message["title"], message["body"]):
            check["told"] = datetime.now(timezone.utc).isoformat()
        else:
            check["message"], pending = message, True
    results["publish"] = check
    drafts.update(draft["id"], {"status": "failed", "results": results,
                                "error": f"Held, nothing went out: LinkedIn needs you to {verb.lower()} it. Tap {verb} on Home, then schedule this post again."})
    ctx.pod.table("activity").create({"skill": "post", "action": "post", "target": draft["id"], "result": "postponed", "page_loads": 0,
                                      "detail": f'Held "{title[:60]}": LinkedIn needs you to {verb.lower()} it first. Nothing went out.'})
    return pending


async def post_clock(ctx: FunctionContext, data: PostClockInput) -> PostClockResult:
    pod = ctx.pod
    drafts = pod.table("drafts")
    draft = drafts.get(data.draft_id)
    if draft.get("status") != "approved":
        return PostClockResult(action="stop", reason=f"draft is {draft.get('status')}, not approved")
    if data.trigger_operation == "UPDATE" and data.trigger_changed is not None and "approved_at" not in data.trigger_changed:
        return PostClockResult(action="stop", reason="started by a write that was not an approval")
    if data.approved_at and draft.get("approved_at") and not _same(data.approved_at, draft.get("approved_at")):
        return PostClockResult(action="stop", reason="approved again since; the newer run owns it")

    fmt = draft.get("format") or "text"
    slot = _parse(draft.get("scheduled_for"))
    left = int((slot - datetime.now(timezone.utc)).total_seconds()) if slot else None
    if left is not None and left > PUBLISH_WITHIN:
        action = "wait_short" if left <= SHORT_WAIT_WITHIN else "wait_long"
        return PostClockResult(action=action, reason=f"{left}s to slot", format=fmt, seconds_left=left)

    run_key = data.run_key or f"run:{data.approved_at or draft.get('approved_at')}:{datetime.now(timezone.utc).isoformat()}"
    stop, alert = _watchdog(ctx, drafts, draft, data.run_key)
    if stop:
        return PostClockResult(action="stop", reason=stop)
    claimed, refused = _claim(drafts, data.draft_id, data.approved_body, run_key)
    if refused:
        return PostClockResult(action="stop", reason=refused)

    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    post_skill = next((s for s in pod.records.list("skills", limit=50).to_dict()["items"] if s.get("key") == "post"), {})
    route, held = _route(profile, post_skill, fmt)
    if route is None:
        pending = hold(ctx, drafts, claimed, held or "connect", profile.get("timezone"))
        return PostClockResult(action="stop", reason=f"held: {held}", tell=pending or alert)
    reason = "no slot: post now" if left is None else f"{left}s to slot"
    return PostClockResult(action="publish", route=route, reason=reason, format=fmt, api=route == "api", tell=alert, seconds_left=left)

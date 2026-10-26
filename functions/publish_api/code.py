#input_type_name: PublishApiInput
#output_type_name: PublishApiResult
#function_name: publish_api

"""Publish an approved text, image or link post through LinkedIn's official API.

It posts as the person (the connector resolves to their own account), so there
is no account id in here.

Before it sends anything it checks the text the way publish_guard does: the
draft is claimed by this run (`publishing`), its body is the one the claim
recorded, it looks like a real post, and the escaped commentary reads back as
exactly that body.

When the API fails (a lapsed connection, an error), the post is held and the
person hears once what to do. It goes to the browser instead only when they
opted in (`skills.post.settings.browser_fallback`). Nothing here ever writes the
draft back to `approved`: on 26 Oct 2026 that write started a new publish run
eleven times in 80 seconds.

A post that went out stays `publishing` until the read-back (publish_guard
`after`) finds the approved text live and marks it `published`.
"""

import hashlib
import os
import re
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from lemma_sdk import FunctionContext
from pydantic import BaseModel

LINKEDIN = "linkedin"
_RESERVED = re.compile(r"([\\|{}@\[\]()<>*_~])")
_HASHTAG = re.compile(r"(?<![\w#])#([A-Za-z][A-Za-z0-9]*)")
_ESCAPED = re.compile(r"\\([\\|{}@\[\]()<>*_~#])")
_TAG = re.compile(r"\{hashtag\|\\#\|([A-Za-z][A-Za-z0-9]*)\}")

# Same rules as publish_guard.text_problem
MIN_CHARS = 80
MIN_WORDS = 12
_PLACEHOLDER_LINE = re.compile(
    r"^(p\d+|para(graph)?\s*\d+|line\s*\d+|test(ing)?(\s*\d+)?|hello (world|test)|asdf\w*|x{2,}|a{3,}|b{3,}"
    r"|placeholder|sample text|dummy text|lorem ipsum.*)[.:!]?$",
    re.I,
)
_PLACEHOLDER_ANY = re.compile(r"lorem ipsum|\{\{|\}\}|\[insert|<insert|\[placeholder", re.I)
_PLACEHOLDER_CAPS = re.compile(r"\b(TODO|TBD|PLACEHOLDER)\b")


class PublishApiInput(BaseModel):
    draft_id: str


class PublishApiResult(BaseModel):
    ok: bool
    use_browser: bool = False  # only for a format the API can't post, or when they opted in
    refused: bool = False  # the text failed a check: the draft is failed and nothing went out
    held: str | None = None  # reconnect | api_error: the post waits for them
    tell: bool = False  # the message about it is waiting in the draft: the workflow's tell step sends it
    url: str | None = None
    error: str | None = None


def body_sha(text: str) -> str:
    """Fingerprint of a post's text. Same in post_clock and publish_guard."""
    return hashlib.sha256((text or "").strip().encode("utf-8")).hexdigest()


def text_problem(text: str) -> str | None:
    """Why this can't be a real post, or None. Same as publish_guard.text_problem."""
    body = (text or "").strip()
    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    if len(body) < MIN_CHARS or len(body.split()) < MIN_WORDS:
        return f"the text is only {len(body.split())} words and {len(body)} characters, which isn't a real post"
    bad = next((ln for ln in lines if _PLACEHOLDER_LINE.match(ln)), None)
    if bad or _PLACEHOLDER_ANY.search(body) or _PLACEHOLDER_CAPS.search(body):
        return f'the text has placeholder or test content in it ("{(bad or body)[:40]}")'
    if len(body) > 3000:
        return "the text is over LinkedIn's 3,000 characters"
    return None


def little_text(text: str) -> str:
    """LinkedIn reads commentary as 'little text': reserved characters need escaping."""
    tags: list[str] = []

    def keep(match: re.Match[str]) -> str:
        tags.append(match.group(1))
        return f"\x00{len(tags) - 1}\x00"

    out = _HASHTAG.sub(keep, text)
    out = _RESERVED.sub(r"\\\1", out).replace("#", "\\#")
    for i, tag in enumerate(tags):
        out = out.replace(f"\x00{i}\x00", "{hashtag|\\#|" + tag + "}")
    return out


def read_little_text(text: str) -> str:
    """What LinkedIn shows for a commentary: little_text undone, to prove it says exactly the body."""
    return _ESCAPED.sub(r"\1", _TAG.sub(lambda m: "#" + m.group(1), text))


def notify(ctx: FunctionContext, title: str, body: str) -> bool:
    """One message to the person, wherever they read them. Same in post_clock and publish_guard.

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


def _slot(value: Any, tz: str | None) -> str:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(ZoneInfo(tz or "UTC"))
        return dt.strftime("%a %H:%M")
    except Exception:
        return "next"


def hold(ctx: FunctionContext, drafts, draft: dict, held: str, tz: str | None, detail: str, raw: str | None = None) -> bool:
    """Keep the post back until the person fixes LinkedIn, and tell them once. Same as post_clock.hold.

    Returns True when the message is waiting for the workflow's tell step (sending from here failed).
    """
    title = draft.get("title") or (draft.get("body") or "")[:50]
    when = _slot(draft.get("scheduled_for"), tz)
    head = "reconnect LinkedIn" if held == "reconnect" else "LinkedIn didn't take it"
    fix = "tap Reconnect on Home (30 seconds)" if held == "reconnect" else "check LinkedIn is connected on Home"
    results = dict(draft.get("results") or {})
    check = dict(results.get("publish") or {})
    check["held"] = held
    if raw:
        check["api_error"] = raw[:500]
    pending = False
    if not check.get("told"):
        message = {"title": f"Your {when} post is waiting: {head}",
                   "body": f'"{title[:60]}" is waiting: {detail}. Open the app, {fix}, then open the post and schedule it again. Nothing has gone out.'}
        if notify(ctx, message["title"], message["body"]):
            check["told"] = datetime.now(timezone.utc).isoformat()
        else:
            check["message"], pending = message, True
    results["publish"] = check
    drafts.update(draft["id"], {"status": "failed", "results": results,
                                "error": f"Held, nothing went out: {detail}. {fix[0].upper() + fix[1:]}, then schedule this post again."})
    ctx.pod.table("activity").create({"skill": "post", "action": "post", "target": draft["id"], "result": "postponed", "page_loads": 0,
                                      "detail": f'Held "{title[:60]}": {detail}. Nothing went out.'})
    return pending


def _find(value: Any, keys: tuple[str, ...]) -> Any:
    if isinstance(value, dict):
        for k in keys:
            if value.get(k) not in (None, ""):
                return value[k]
        for child in value.values():
            hit = _find(child, keys)
            if hit not in (None, ""):
                return hit
    elif isinstance(value, list):
        for child in value:
            hit = _find(child, keys)
            if hit not in (None, ""):
                return hit
    return None


def _note_connection(pod, profile: dict, exc: Exception | None) -> None:
    """Tell "Needs your help" straight away when LinkedIn wants reconnecting, and clear it once a post goes through."""
    health = dict(profile.get("health") or {})
    prev = dict(health.get("linkedin") or {})
    now = datetime.now(timezone.utc).isoformat()
    if exc is None:
        state = "ok"
    else:
        text = f"{getattr(exc, 'code', '') or ''} {exc}".upper()
        if "REAUTH" in text or "UNAUTHORIZED" in text:
            state = "reconnect"
        elif "CONNECTION_REQUIRED" in text:
            state = "missing"
        else:
            return  # a network blip: the health check decides whether it lasts
    if prev.get("state") == state:
        return
    health["linkedin"] = {**prev, "state": state, "since": now, "checked_at": now}
    try:
        pod.table("profile").update(profile["id"], {"health": health})
    except Exception:
        pass  # the post matters more than the note


async def publish_api(ctx: FunctionContext, data: PublishApiInput) -> PublishApiResult:
    pod = ctx.pod
    drafts = pod.table("drafts")
    draft = drafts.get(data.draft_id)
    claim = (draft.get("results") or {}).get("publish") or {}
    if draft.get("status") != "publishing" or not claim.get("body_sha"):
        return PublishApiResult(ok=False, error=f"draft is {draft.get('status')} and not claimed by this run")

    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    fmt = draft.get("format") or "text"
    urn = profile.get("linkedin_urn")
    if fmt not in ("text", "image", "link"):
        return PublishApiResult(ok=False, use_browser=True, error="not an API post")
    if not (profile.get("linkedin_api") and urn):
        pending = hold(ctx, drafts, draft, "reconnect", profile.get("timezone"), "LinkedIn isn't connected")
        return PublishApiResult(ok=False, held="reconnect", tell=pending, error="not connected")

    body = (draft.get("body") or "").strip()
    commentary = little_text(body)
    if body_sha(body) != claim["body_sha"]:
        problem = "the text changed after it was approved"
    elif read_little_text(commentary) != body:
        problem = "the text didn't survive LinkedIn's formatting unchanged"
    else:
        problem = text_problem(body)
    if problem:
        drafts.update(data.draft_id, {"status": "failed", "error": f"Not posted: {problem}."})
        return PublishApiResult(ok=False, refused=True, error=problem)

    payload: dict[str, Any] = {
        "author": urn,
        "commentary": commentary,
        "visibility": "PUBLIC",
        "lifecycleState": "PUBLISHED",
    }
    media = [m for m in (draft.get("media") or []) if m]
    if fmt == "image" and media:
        payload["images"] = [{"pod_path": m} for m in media[:20]]

    post_skill = next((r for r in pod.records.list("skills", limit=50).to_dict()["items"] if r.get("key") == "post"), {})
    browser_ok = bool((post_skill.get("settings") or {}).get("browser_fallback"))

    def failed(exc_text: str, auth: bool) -> PublishApiResult:
        if browser_ok:
            drafts.update(data.draft_id, {"error": f"API failed, using the browser as you chose: {exc_text[:400]}"})
            return PublishApiResult(ok=False, use_browser=True, error=exc_text[:500])
        held = "reconnect" if auth else "api_error"
        pending = hold(ctx, drafts, drafts.get(data.draft_id), held, profile.get("timezone"),
                       "LinkedIn needs you to reconnect it" if auth else "LinkedIn's API answered with an error", raw=exc_text)
        return PublishApiResult(ok=False, held=held, tell=pending, error=exc_text[:500])

    try:
        result = pod.connectors.execute(LINKEDIN, "LINKEDIN_CREATE_LINKED_IN_POST", payload).to_dict()
    except Exception as exc:  # no account, expired token, network
        _note_connection(pod, profile, exc)
        text = f"{getattr(exc, 'code', '') or ''} {exc}"
        return failed(str(exc), any(k in text.upper() for k in ("REAUTH", "UNAUTHORIZED", "CONNECTION_REQUIRED", "NOT_CONNECTED", "NO ACCOUNT")))

    outcome = result.get("result", result)
    if isinstance(outcome, dict) and outcome.get("successful") is False:
        return failed(str(outcome.get("error")), False)

    urn_post = _find(outcome, ("x_restli_id", "id", "urn"))
    url = f"https://www.linkedin.com/feed/update/{urn_post}/" if urn_post and str(urn_post).startswith("urn:li:") else None
    now = datetime.now(timezone.utc).isoformat()
    # Out, but `publishing` until the read-back finds the approved text live (publish_guard `after`).
    drafts.update(data.draft_id, {"via": "api", "published_at": now, "post_url": url, "error": None})
    _note_connection(pod, profile, None)
    pod.table("activity").create({"skill": "post", "action": "post", "target": url or data.draft_id, "result": "ok", "page_loads": 0,
                                  "detail": "Sent through the LinkedIn API; reading it back next to check the text."})
    return PublishApiResult(ok=True, url=url)

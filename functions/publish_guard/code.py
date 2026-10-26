#input_type_name: PublishGuardInput
#output_type_name: PublishGuardResult
#function_name: publish_guard

"""The gate every post passes before and after it goes out.

`before` (browser path): the draft must be claimed by its publish run
(`publishing`, see post_clock), its text must still be the text that was
claimed, and it must look like a real post (no placeholders such as "P1" / "P2",
not a few words). It takes the person's browser for this post (browser_lock),
then hands back the exact text to post. Only one check per claim, so a second
agent working the same draft is turned away.

`tell`: a message post_clock or publish_api couldn't send themselves (a held
post, a runaway alert), for the workflow's tell step to send once.

`after` (both paths): what the read-back of the live post found, compared with
the approved text. Only a match marks the draft `published`. A mismatch marks it
`failed` with a plain reason, deletes nothing, and tells the person at once. It
gives the browser back.

Messages go to the person from here, once per post. When sending fails, the
result carries the message for the agent to send instead.

On 26 Oct 2026 a two-line test string ("P1", "P2") went out in place of an
approved post, and the agent recorded it as published. This exists so that the
text that goes out, and the record of it, are checked by code.
"""

import hashlib
import os
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any

from lemma_sdk import FunctionContext
from pydantic import BaseModel

MIN_CHARS = 80
MIN_WORDS = 12
LOCK_MINUTES = 20  # how long a publish may hold the browser
SETTLE = 1.5  # seconds between writing the lock and reading it back

_PLACEHOLDER_LINE = re.compile(
    r"^(p\d+|para(graph)?\s*\d+|line\s*\d+|test(ing)?(\s*\d+)?|hello (world|test)|asdf\w*|x{2,}|a{3,}|b{3,}"
    r"|placeholder|sample text|dummy text|lorem ipsum.*)[.:!]?$",
    re.I,
)
_PLACEHOLDER_ANY = re.compile(r"lorem ipsum|\{\{|\}\}|\[insert|<insert|\[placeholder", re.I)
_PLACEHOLDER_CAPS = re.compile(r"\b(TODO|TBD|PLACEHOLDER)\b")
_INVISIBLE = re.compile(r"[​‌‍⁠﻿]")
_URL = re.compile(r"https?://\S+")
_MORE = re.compile(r"\s*(…|\.\.\.)?\s*(see )?more\s*$", re.I)
_AGE = re.compile(r"^(now|just now|\d+\s?[smhdw]|\d+\s?(sec|min|mins|minute|minutes|hour|hours|hr|hrs)( ago)?)(\s*[•·].*)?$", re.I)
_FOOTER = re.compile(r"^(\d[\d,.]*\s*(k\s*)?(impressions?|reactions?|comments?|reposts?)?|view analytics|boost|like|comment|repost|send|(…|\.\.\.)?\s*(see )?more)$", re.I)


class PublishGuardInput(BaseModel):
    draft_id: str
    stage: str  # before | after | tell
    clicked: bool = False  # after: was Post clicked (or the API call made)
    text: str | None = None  # after: the live post's text as read back, None if it couldn't be read
    card: str | None = None  # after: the whole activity card it was read from, when there is one
    post_url: str | None = None
    note: str | None = None  # after: what happened, in a plain sentence, when it didn't go out


class PublishGuardResult(BaseModel):
    ok: bool
    reason: str
    text: str | None = None  # before: the exact text to post
    sha: str | None = None  # before: its fingerprint, for publish_post.py --sha
    format: str | None = None
    verdict: str | None = None  # after: match | partial | mismatch | unread | not_posted
    owner: str | None = None  # before: who holds the browser for this post; pass it to function_allowance
    busy: bool = False  # before: another run holds the browser; wait and ask again
    told: bool = False  # the person was messaged from here
    message_title: str | None = None  # only when messaging from here failed: send these with message_user, once
    message_body: str | None = None


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def notify(ctx: FunctionContext, title: str, body: str) -> bool:
    """One message to the person, wherever they read them. Same in post_clock and publish_api.

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


def take_browser(pod, owner: str) -> str | None:
    """browser_lock's take, for publishing. Returns who else holds it, or None when it's ours."""
    profiles = pod.table("profile")
    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    if not profile.get("id"):
        return "nobody: there is no profile"
    now = datetime.now(timezone.utc)
    lock = profile.get("browser_lock") or {}
    until = _parse(lock.get("until"))
    if lock.get("owner") and lock.get("owner") != owner and until and until > now:
        return lock["owner"]
    profiles.update(profile["id"], {"browser_lock": {"owner": owner, "until": (now + timedelta(minutes=LOCK_MINUTES)).isoformat(), "taken_at": now.isoformat()}})
    time.sleep(SETTLE)
    after = profiles.get(profile["id"]).get("browser_lock") or {}
    return None if after.get("owner") == owner else after.get("owner") or "someone"


def give_browser(pod, owner: str | None) -> None:
    if not owner:
        return
    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    if profile.get("id") and (profile.get("browser_lock") or {}).get("owner") == owner:
        pod.table("profile").update(profile["id"], {"browser_lock": None})


def body_sha(text: str) -> str:
    """Fingerprint of a post's text. Same in post_clock and publish_api."""
    return hashlib.sha256((text or "").strip().encode("utf-8")).hexdigest()


def text_problem(text: str) -> str | None:
    """Why this can't be a real post, or None. Same rules in publish_api."""
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


def normalize(text: str) -> str:
    """Text as a reader sees it: one line per paragraph, links and LinkedIn's screen-reader extras ignored."""
    text = unicodedata.normalize("NFC", text or "")
    text = _INVISIBLE.sub("", text).replace(" ", " ").replace("hashtag#", "#")
    text = _URL.sub("<link>", text)
    text = re.sub(r"@(?=\w)", "", text)
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    return "\n".join(ln for ln in lines if ln)


def _in_card(want: list[str], card: list[str]) -> str | None:
    """The post's lines as one run inside its activity card, right after the age and followed only by the footer."""
    for i in range(len(card)):
        n = 0
        while n < len(want) and i + n < len(card) and card[i + n] == want[n]:
            n += 1
        if n == 0 or (i > 0 and not _AGE.match(card[i - 1])):
            continue
        rest = card[i + n:]
        if n == len(want) and all(_FOOTER.match(ln) for ln in rest[:1]):
            return "match"
        cut = rest[0] if rest else ""
        if n < len(want) and cut and _MORE.search(cut):
            head = _MORE.sub("", cut).rstrip(" .…")
            if not head or want[n].startswith(head):
                return "partial"  # everything LinkedIn shows before "…more" is the approved text
    return None


def compare(expected: str, got: str | None, card: str | None = None) -> str:
    want = normalize(expected)
    if got is not None:
        seen = normalize(got)
        if seen == want:
            return "match"
        cut = _MORE.sub("", seen).rstrip(" .…")
        if cut and cut != seen and want.startswith(cut) and len(cut) >= len(want.split("\n")[0]):
            return "partial"  # cut off by "…more", and all of it so far is the approved text
    if card:
        return _in_card(want.split("\n"), normalize(card).split("\n")) or "mismatch"
    return "mismatch"


def _card_text(card: str) -> str:
    """The post's own lines in an activity card: after the age, before the footer."""
    lines = normalize(card).split("\n")
    start = next((i + 1 for i, ln in enumerate(lines) if _AGE.match(ln)), 0)
    out = []
    for ln in lines[start:]:
        if _FOOTER.match(ln):
            break
        out.append(ln)
    return "\n".join(out)


def _head(text: str, n: int = 80) -> str:
    one = " ".join((text or "").split())
    return one if len(one) <= n else one[: n - 1].rstrip() + "…"


async def publish_guard(ctx: FunctionContext, data: PublishGuardInput) -> PublishGuardResult:
    pod = ctx.pod
    drafts = pod.table("drafts")
    draft = drafts.get(data.draft_id)
    title = draft.get("title") or _head(draft.get("body") or "", 60)
    body = (draft.get("body") or "").strip()
    results = dict(draft.get("results") or {})
    check = dict(results.get("publish") or {})
    now = datetime.now(timezone.utc).isoformat()

    def save(fields: dict) -> None:
        results["publish"] = check
        drafts.update(data.draft_id, {**fields, "results": results})

    def tell(title_: str, body_: str) -> dict:
        """Message the person once per post; hand the text to the agent only if sending failed."""
        if check.get("told"):
            return {}
        if notify(ctx, title_, body_):
            check["told"] = now
            return {"told": True}
        check["told"] = now  # the agent sends it now
        return {"message_title": title_, "message_body": body_}

    def refuse(reason: str) -> PublishGuardResult:
        """Stop before anything goes out: the draft fails with a plain reason, and the person hears once."""
        msg = tell(f'I didn\'t post "{_head(title, 50)}"', f"{reason[0].upper() + reason[1:]}. Nothing went out. Fix it in the app and schedule it again.")
        save({"status": "failed", "error": f"Not posted: {reason}."})
        return PublishGuardResult(ok=False, reason=reason, **msg)

    if data.stage == "before":
        if draft.get("status") != "publishing" or not check.get("body_sha"):
            reason = f"draft is {draft.get('status')} and not claimed by its publish run, so don't post it"
            if check.get("message") and not check.get("told"):
                # A run on the workflow from before the tell step reaches here after a hold: pass its message on.
                message = check["message"]
                check["told"], check["message"] = now, None
                save({})
                return PublishGuardResult(ok=False, reason=reason + "; send this message, once", message_title=message["title"], message_body=message["body"])
            return PublishGuardResult(ok=False, reason=reason)
        if check.get("checked_at"):
            return PublishGuardResult(ok=False, reason="another run is already publishing this draft, so stop and don't touch the browser")
        if body_sha(body) != check["body_sha"]:
            return refuse("the text changed after it was approved")
        problem = text_problem(body)
        if problem:
            return refuse(problem)
        owner = f"publish {data.draft_id[:8]} #{check.get('attempt') or 1}"
        holder = take_browser(pod, owner)
        if holder:
            return PublishGuardResult(ok=False, busy=True, reason=f"the browser is in use by {holder}: wait two minutes and call before again; don't open LinkedIn")
        check.update({"checked_at": now, "lock": owner})
        save({})
        return PublishGuardResult(ok=True, reason="the browser is yours for this post: post exactly this text", text=body, sha=check["body_sha"], owner=owner, format=draft.get("format") or "text")

    if data.stage == "tell":
        # Messages post_clock or publish_api couldn't send themselves: send them once, together.
        watch = dict(results.get("watchdog") or {})
        waiting = [m for m in (check.get("message") if not check.get("told") else None,
                               watch.get("message") if not watch.get("told") else None) if m]
        if not waiting:
            return PublishGuardResult(ok=True, reason="nothing waiting to be sent")
        if not check.get("told") and check.get("message"):
            check["told"], check["message"] = now, None
        if watch.get("message") and not watch.get("told"):
            watch["told"], watch["message"] = now, None
            results["watchdog"] = watch
        save({})
        return PublishGuardResult(ok=True, reason="send this with message_user, once", message_title=waiting[0]["title"],
                                  message_body="\n\n".join(m["body"] for m in waiting))

    if data.stage != "after":
        return PublishGuardResult(ok=False, reason=f"unknown stage {data.stage!r}")
    if draft.get("status") not in ("publishing", "published") or not check.get("body_sha"):
        return PublishGuardResult(ok=False, reason=f"draft is {draft.get('status')}, nothing to check")
    if check.get("verdict"):
        return PublishGuardResult(ok=check["verdict"] in ("match", "partial"), reason="already checked", verdict=check["verdict"])
    via = draft.get("via") or "browser"
    url = data.post_url or draft.get("post_url")
    published = {"status": "published", "via": via, "published_at": draft.get("published_at") or now, "post_url": url, "error": None}
    activity = pod.table("activity")
    give_browser(pod, check.get("lock"))

    if not data.clicked:
        check["verdict"] = "not_posted"
        note = (data.note or "the browser couldn't get the post out").rstrip(".")
        msg = tell(f'Your post "{_head(title, 50)}" didn\'t go out', f"{note[0].upper() + note[1:]}. Nothing went out, and nothing retries on its own. Schedule it again in the app to try once more.")
        save({"status": "failed", "error": f"Not posted: {note}."})
        activity.create({"skill": "post", "action": "post", "target": data.draft_id, "detail": f'Didn\'t post "{_head(title, 60)}": {note}.', "result": "failed", "page_loads": 0})
        return PublishGuardResult(ok=False, reason="marked failed", verdict="not_posted", **msg)

    if data.text is None and not data.card:
        check["verdict"] = "unread"
        msg = tell(f'"{_head(title, 50)}" is out, but please check it', "I posted it, then couldn't read it back to make sure the text is right. Have a quick look at your profile.")
        save(published)
        activity.create({"skill": "post", "action": "post", "target": url or data.draft_id, "detail": f'Published "{_head(title, 60)}" but couldn\'t read it back to check the text.', "result": "warning", "page_loads": 0})
        return PublishGuardResult(ok=True, reason="published, not verified", verdict="unread", **msg)

    seen = data.text if data.text is not None else _card_text(data.card or "")
    verdict = compare(body, data.text, data.card)
    check.update({"verdict": verdict, "verified_at": now, "seen": _head(seen, 200)})
    if verdict in ("match", "partial"):
        save(published)
        activity.create({"skill": "post", "action": "post", "target": url or data.draft_id, "detail": f'Published "{_head(title, 60)}" and read it back: the text matches what you approved.', "result": "ok", "page_loads": 0})
        return PublishGuardResult(ok=True, reason="published and the text matches", verdict=verdict)

    reason = f'What went out doesn\'t match the approved text. It starts "{_head(seen, 60)}"'
    msg = tell(
        "Your post went out with the wrong text",
        f'"{_head(title, 50)}" went out, but what\'s live starts "{_head(seen, 60)}", not your approved text. '
        "I haven't deleted anything. Check your profile and delete it if it's wrong, then tell me whether to post the approved text.",
    )
    save({"status": "failed", "via": via, "post_url": url, "error": reason + ". Nothing was deleted."})
    activity.create({"skill": "post", "action": "post", "target": url or data.draft_id, "detail": f"{reason}. Marked failed; nothing deleted.", "result": "failed", "page_loads": 0})
    return PublishGuardResult(ok=False, reason="mismatch: marked failed", verdict="mismatch", **msg)

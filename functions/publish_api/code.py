#input_type_name: PublishApiInput
#output_type_name: PublishApiResult
#function_name: publish_api

"""Publish an approved text, image or link post through LinkedIn's official API.

This is the upgrade path: it only runs when the person connected LinkedIn as a
connector. It posts as them (the connector resolves to their own account), so
there is no account id in here. Anything it cannot do (a PDF carousel, a poll,
no connection, an API error) comes back as `use_browser`, and the workflow hands
the post to the teammate to publish in the person's signed-in browser instead.
"""

import re
from datetime import datetime, timezone
from typing import Any

from lemma_sdk import FunctionContext
from pydantic import BaseModel

LINKEDIN = "linkedin"
_RESERVED = re.compile(r"([\\|{}@\[\]()<>*_~])")
_HASHTAG = re.compile(r"(?<![\w#])#([A-Za-z][A-Za-z0-9]*)")


class PublishApiInput(BaseModel):
    draft_id: str


class PublishApiResult(BaseModel):
    ok: bool
    use_browser: bool = False
    url: str | None = None
    error: str | None = None


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
    if draft.get("status") not in ("approved", "publishing"):
        return PublishApiResult(ok=False, error=f"draft is {draft.get('status')}")

    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    fmt = draft.get("format") or "text"
    urn = profile.get("linkedin_urn")
    if not (profile.get("linkedin_api") and urn and fmt in ("text", "image", "link")):
        return PublishApiResult(ok=False, use_browser=True, error="not an API post")

    body = (draft.get("body") or "").strip()
    if not body or len(body) > 3000:
        drafts.update(data.draft_id, {"status": "failed", "error": "text is empty or over 3000 characters"})
        return PublishApiResult(ok=False, error="text is empty or over 3000 characters")

    drafts.update(data.draft_id, {"status": "publishing", "error": None, "attempts": int(draft.get("attempts") or 0) + 1})
    payload: dict[str, Any] = {
        "author": urn,
        "commentary": little_text(body),
        "visibility": "PUBLIC",
        "lifecycleState": "PUBLISHED",
    }
    media = [m for m in (draft.get("media") or []) if m]
    if fmt == "image" and media:
        payload["images"] = [{"pod_path": m} for m in media[:20]]

    try:
        result = pod.connectors.execute(LINKEDIN, "LINKEDIN_CREATE_LINKED_IN_POST", payload).to_dict()
    except Exception as exc:  # no account, expired token, network: fall back to the browser
        _note_connection(pod, profile, exc)
        drafts.update(data.draft_id, {"status": "approved", "error": f"API failed, using the browser: {str(exc)[:500]}"})
        return PublishApiResult(ok=False, use_browser=True, error=str(exc)[:500])

    outcome = result.get("result", result)
    if isinstance(outcome, dict) and outcome.get("successful") is False:
        drafts.update(data.draft_id, {"status": "approved", "error": f"API refused, using the browser: {str(outcome.get('error'))[:500]}"})
        return PublishApiResult(ok=False, use_browser=True, error=str(outcome.get("error"))[:500])

    urn_post = _find(outcome, ("x_restli_id", "id", "urn"))
    url = f"https://www.linkedin.com/feed/update/{urn_post}/" if urn_post and str(urn_post).startswith("urn:li:") else None
    now = datetime.now(timezone.utc).isoformat()
    drafts.update(data.draft_id, {"status": "published", "via": "api", "published_at": now, "post_url": url, "error": None})
    _note_connection(pod, profile, None)
    pod.table("activity").create({"skill": "post", "action": "post", "target": url or data.draft_id, "detail": "published through the LinkedIn API", "page_loads": 0})
    return PublishApiResult(ok=True, url=url)

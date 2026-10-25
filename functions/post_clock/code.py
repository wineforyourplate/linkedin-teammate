#input_type_name: PostClockInput
#output_type_name: PostClockResult
#function_name: post_clock

"""One tick of an approved post's clock: publish now, wait a little, wait an hour, or stop.

A workflow wait only takes a fixed number of seconds, so the publish run loops
tick → wait → tick until the slot arrives. Every tick re-reads the draft, so
editing or killing it stops the run, and a run started by an older approval
stops when the draft was approved again since (the newer approval has its own run).
"""

from datetime import datetime, timezone
from typing import Any

from lemma_sdk import FunctionContext
from pydantic import BaseModel

PUBLISH_WITHIN = 120  # seconds: close enough to the slot
SHORT_WAIT_WITHIN = 75 * 60  # under this, check every 5 minutes


class PostClockInput(BaseModel):
    draft_id: str
    approved_at: str | None = None


class PostClockResult(BaseModel):
    action: str  # publish | wait_short | wait_long | stop
    reason: str
    format: str | None = None
    api: bool = False
    seconds_left: int | None = None


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def post_clock(ctx: FunctionContext, data: PostClockInput) -> PostClockResult:
    pod = ctx.pod
    draft = pod.table("drafts").get(data.draft_id)
    if draft.get("status") != "approved":
        return PostClockResult(action="stop", reason=f"draft is {draft.get('status')}, not approved")
    started_by, current = _parse(data.approved_at), _parse(draft.get("approved_at"))
    if started_by and current and abs((current - started_by).total_seconds()) > 1:
        return PostClockResult(action="stop", reason="approved again since; the newer run owns it")

    profile = (pod.records.list("profile", limit=1).to_dict()["items"] or [{}])[0]
    fmt = draft.get("format") or "text"
    api = bool(profile.get("linkedin_api")) and bool(profile.get("linkedin_urn")) and fmt in ("text", "image", "link")

    slot = _parse(draft.get("scheduled_for"))
    if slot is None:
        return PostClockResult(action="publish", reason="no slot: post now", format=fmt, api=api)
    left = int((slot - datetime.now(timezone.utc)).total_seconds())
    action = "publish" if left <= PUBLISH_WITHIN else "wait_short" if left <= SHORT_WAIT_WITHIN else "wait_long"
    return PostClockResult(action=action, reason=f"{left}s to slot", format=fmt, api=api, seconds_left=left)

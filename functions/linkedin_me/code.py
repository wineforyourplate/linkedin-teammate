#input_type_name: LinkedinMeInput
#output_type_name: LinkedinMeResult
#function_name: linkedin_me

"""Who is this person on LinkedIn, straight from their LinkedIn connection.

This is the fast path for onboarding's "Is this you?": one API call returns the
exact name, headline, photo and profile link, where a web search takes a minute
and can miss. It only reads and returns; the app writes the profile once the
person says "That's me". No connection, an expired one or an error all come back
as connected: false, and the app falls back to the pasted link.
"""

from typing import Any

from lemma_sdk import FunctionContext
from pydantic import BaseModel

LINKEDIN = "linkedin"


class LinkedinMeInput(BaseModel):
    pass


class LinkedinMeResult(BaseModel):
    connected: bool
    first_name: str | None = None
    last_name: str | None = None
    name: str | None = None
    headline: str | None = None
    photo_url: str | None = None
    profile_url: str | None = None
    urn: str | None = None
    error: str | None = None


def _localized(value: Any) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        loc = value.get("localized")
        if isinstance(loc, dict):
            for text in loc.values():
                if isinstance(text, str) and text.strip():
                    return text.strip()
    return None


def _photo(value: Any) -> str | None:
    if isinstance(value, str):
        return value or None
    if isinstance(value, dict):
        for key in ("displayImage", "display_image", "url"):
            hit = _photo(value.get(key))
            if hit:
                return hit
        for child in value.values():
            hit = _photo(child) if isinstance(child, (dict, list)) else None
            if hit and hit.startswith("http"):
                return hit
    if isinstance(value, list):
        for child in value:
            hit = _photo(child)
            if hit and hit.startswith("http"):
                return hit
    return None


async def linkedin_me(ctx: FunctionContext, data: LinkedinMeInput) -> LinkedinMeResult:
    try:
        result = ctx.pod.connectors.execute(LINKEDIN, "LINKEDIN_GET_MY_INFO", {}).to_dict()
    except Exception as exc:  # no account, expired token, network
        return LinkedinMeResult(connected=False, error=str(exc)[:300])

    info = result.get("result", result)
    if isinstance(info, dict) and info.get("successful") is False:
        return LinkedinMeResult(connected=False, error=str(info.get("error"))[:300])
    if isinstance(info, dict) and isinstance(info.get("data"), dict):
        info = info["data"]
    if not isinstance(info, dict):
        return LinkedinMeResult(connected=False, error="unexpected answer from LinkedIn")

    first = info.get("localizedFirstName") or _localized(info.get("firstName")) or info.get("given_name")
    last = info.get("localizedLastName") or _localized(info.get("lastName")) or info.get("family_name")
    name = " ".join(x for x in (first, last) if x) or info.get("name")
    member = info.get("id") or info.get("sub")
    vanity = info.get("vanityName")
    url = info.get("profileUrl") or (f"https://www.linkedin.com/in/{vanity}" if vanity else None)
    return LinkedinMeResult(
        connected=bool(member or name),
        first_name=first,
        last_name=last,
        name=name,
        headline=info.get("localizedHeadline") or _localized(info.get("headline")),
        photo_url=_photo(info.get("profilePicture")) or info.get("picture"),
        profile_url=url,
        urn=f"urn:li:person:{member}" if member else None,
    )

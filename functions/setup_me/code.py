#input_type_name: SetupMeInput
#output_type_name: SetupMeResult
#function_name: setup_me

"""Make sure the calling person has a profile row and one row per skill.

Runs as the caller, and every table here is private to its owner, so this only
ever touches the caller's own rows. Safe to call on every app load: it creates
what is missing and changes nothing that exists.
"""

from typing import Any

from lemma_sdk import FunctionContext
from pydantic import BaseModel

SKILLS: dict[str, dict[str, Any]] = {
    "optimize_profile": {"approval": "each", "caps": {"edits_per_day": 5}},
    "post": {"approval": "each", "caps": {"posts_per_day": 1}},
    "warm_up": {
        "approval": "within_limits",
        "caps": {
            "days": 14,
            "likes": [5, 5, 6, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15],
            "profile_views": [5, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9, 10, 10, 10],
            "accept_invites": 10,
        },
    },
    "engage": {"approval": "each", "caps": {"posts_per_day": 10, "likes": 20, "comments": 10}},
    "find_people": {"approval": "each", "caps": {"profiles_per_day": 25, "list_size": 50}},
    "connect": {
        "approval": "each",
        "caps": {"ramp": [5, 8, 12, 15], "weekly": [35, 50, 75, 100], "min_acceptance": 0.3, "max_pending": 500},
    },
    "follow_up": {"approval": "each", "caps": {"ramp": [3, 5, 10, 20], "max_followups": 1}},
}


class SetupMeInput(BaseModel):
    display_name: str | None = None
    timezone: str | None = None


class SetupMeResult(BaseModel):
    profile: dict[str, Any]
    skills: list[dict[str, Any]]
    created: bool


async def setup_me(ctx: FunctionContext, data: SetupMeInput) -> SetupMeResult:
    pod = ctx.pod
    profiles = pod.records.list("profile", limit=1).to_dict()["items"]
    created = not profiles
    if created:
        name = (data.display_name or "").strip()
        row: dict[str, Any] = {"onboarding_step": "hello"}
        if name:  # kept for reference only; the app greets by name once LinkedIn confirms it
            row["display_name"] = name
        if data.timezone:
            row["timezone"] = data.timezone
        profile = pod.table("profile").create(row)
    else:
        profile = profiles[0]

    have = {r["key"] for r in pod.records.list("skills", limit=50).to_dict()["items"]}
    for key, spec in SKILLS.items():
        if key not in have:
            pod.table("skills").create({"key": key, "state": "off", **spec})
    skills = pod.records.list("skills", limit=50).to_dict()["items"]
    return SetupMeResult(profile=profile, skills=skills, created=created)

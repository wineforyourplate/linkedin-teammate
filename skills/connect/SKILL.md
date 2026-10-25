---
name: connect
description: "Send connection requests to people the person approved (`people` stage: approved), with a short personal note when there's a genuine reason, ramped from 5 a day and paused if fewer than 30% accept. Detects page state from URLs, handles LinkedIn's note dialog and the free note quota, verifies Pending, logs everything, and withdraws invites older than 21 days. Use for the connect skill in a session or its first run."
---

# Send connection requests

The riskiest job, so it's the most careful.

Load `linkedin-browser` first (stop rules in §8 matter here). Only people with `stage: approved` are
ever invited.

## Before anything

- Warm-up must be done (or the account already active). If `warm_up` is on and below day 14, set this
  skill to `needs_you` with "I'll start after warm-up (day N of 14)" and stop.
- Call `function_allowance` `{skill: "connect", action: "invite", count: <queue size>}`. It holds the
  ramp (5 → 8 → 12 → 15 a day by week; weekly caps 35 → 100), the pending limit and the 30%
  acceptance pause. Send at most `allowed`.
- Space invites: at least 3–5 minutes apart, inside working hours, drifting through the feed between
  them. Never more than 10 in one session.

## For each approved person

1. Open their profile (`profile_url`). Read the top card and their last 2 weeks of posts.
2. **Detect state** (see `linkedin-browser` §7):
   - pending: set `invited`;
   - already connected: set `accepted`, `accepted_at` unknown;
   - they invited you: accept it, set `accepted`;
   - follow-only: Connect is under **More**;
   - can't be invited: skip them with a note.
3. **The note.**
   - Use `invite_note` if they approved one. Otherwise write one only if there's a real hook: a post
     from the last 2 weeks, a shared background, or their comment on the person's post.
   - Shape: one specific reference + one line about who they are + no ask. Never "I came across your
     profile", never a pitch.
   - At most 200 characters (count them), no em dashes (—). With no hook, send without a note.
4. **Click Connect** (or More → Connect). LinkedIn may ask "Add a note to your invitation?": choose
   **Add a note**, type it in chunks, then **Send invitation**. If a Premium upsell appears instead of
   the note box, the free note quota is used up. Send without a note if `settings.send_without_note` is
   true; otherwise stop sending today and tell them.
5. **Verify**: re-read the page and confirm the Pending state.
6. Update the person: `stage: invited`, `invited_at`, the note actually sent in `invite_note`. Log
   `activity` `{action: "invite", target: <url>, detail: "Invited Priya Rao (note: …)"}`.

## Housekeeping (once a day)

- My Network → Manage → **Sent**. For people still pending after 21 days, withdraw: set `withdrawn`,
  log `withdraw`. LinkedIn blocks re-inviting them for 3 weeks.
- Recent connections: anyone `invited` who now shows as connected → `accepted`, `accepted_at` now.
  This feeds Follow up.
- Update `status_text`: "Day 9 · 6 sent today · 41% accepted (12 of 29)".

## Approval mode

- `approval: each` (default): you send only to people they approved one by one, or as a list.
- `within_limits`: only if they chose it. You may also invite people you found with score ≥ 7. Still
  within every cap.

**Works better with:**
- Sales Navigator: InMail for people who don't accept within a week;
- your CRM: never invite someone your team already talks to.

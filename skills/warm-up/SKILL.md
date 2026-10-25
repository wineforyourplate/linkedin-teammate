---
name: warm-up
description: "Warm up the person's LinkedIn account: a few minutes of normal activity at random times each day for 14 days (4–8 weeks for a new account), so their posts and invites land and the account stays healthy before any outreach. Runs in their signed-in Lemma browser within a ramp that rises day by day. Use for the warm_up skill in a session, on its first run, or when asked to warm up, or why invites aren't being accepted."
---

# Warm up my account

A quiet account that suddenly sends twenty invites looks like a bot, to LinkedIn and to the people
receiving them. Warm-up makes the account look like what it is: a real person who reads, reacts and
knows people in their field. It is also the job that protects every later one.

Load `linkedin-browser` first. Everything there applies.

## When it's recommended

Recommend it (one recommendation row, `skill_key: "warm_up"`) when any of these is true:
- the person hasn't posted or been active for 30 days or more;
- the account is new or has fewer than about 150 connections;
- they want to start connection requests (switch 6) and warm-up hasn't run yet.

The why must come from their own data, e.g. "Your last post was 7 weeks ago and you have 31 pending
invitations."

## What a session does

Do these in a natural order, pausing as `linkedin-browser` says, within `function_allowance` for each
action (`skill: "warm_up"`):

1. **Read the feed** for 2–4 minutes: open it, scroll slowly, open one or two posts that match the
   person's topics (`facts` with `section: "topics"`) and read them. Log `page_load`s.
2. **View profiles** (`action: "view_profile"`): people in their world. These are authors of good posts
   in their topics, people from their target audience (`facts` → `audience`), and people who
   viewed them or engaged with their posts. Read the top of each profile and scroll a little.
3. **React** (`action: "like"`) to the posts you actually read that are worth a like: relevant,
   recent, not controversial. Never like politics, tragedy, job-loss posts or anything the person
   would be embarrassed by.
4. **Accept invitations** from real people (`action: "accept_invite"`): My Network → Invitations.
   Accept a person with a real profile in or near their field. Skip blank profiles, obvious sales
   automation, recruiters spamming, or anything that looks fake. Leave doubtful ones for the person.
   A `note` activity row lists what you skipped and why.

Two sessions a day (late morning and afternoon) split the day's allowance roughly in half.

## The ramp

`function_allowance` holds the numbers. The defaults live in the skill's `caps`:

| Day | Likes | Profile views | Accept |
| --- | --- | --- | --- |
| 1–2 | 5 | 5 | up to 10 |
| 3–7 | 6–8 | 6–8 | up to 10 |
| 8–14 | 9–15 | 8–10 | up to 10 |

- For an account under ~150 connections or created this year, set `caps.days` to 42 and hold each step
  for a week.
- **After a pause** the allowance restarts softly on its own (half for 3 days, then three quarters).
  When the person turns warm-up back on, set `settings.resumed_at` to now.
- **Editing caps or hours never resets the day count.** The day comes from `started_at`.

## Keep the skill row honest

After each session:
- `day` = the current day number;
- `status_text` = "Day 6 of 14 · 9 likes, 7 profiles, 3 invites accepted today";
- `last_run_at` = now, and `last_result` = one sentence.

On day 14 (or `caps.days`):
- set `status_text: "Done · your account is warm"`, keeping it `on` at a maintenance level (every
  session reads the feed and likes a few posts);
- create the next recommendation: "Engage on posts" if it isn't on yet. If connections are their goal
  and "Find my people" has an approved list, "Send connection requests".

## The checklist variant (no browser)

If the person never signs in to the browser, warm-up can still help as a **daily checklist** they do
themselves in 10 minutes. In the morning brief, list today's 3–4 actions with links: "like 5 posts
from these people", "accept these 3 invitations", "view these profiles". Say plainly that it works
better when the teammate does it in their browser.

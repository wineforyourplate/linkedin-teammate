# Teammate app: design

## Who and what
- **For:** one founder or operator growing their own LinkedIn. They want 10 minutes a day, no tool to
  learn, and nothing going out without their OK.
- **Job:** approve what the teammate prepared (posts, people, messages, comments to post, profile
  changes) and switch skills on when they're ready.
- **Hero moment:** Your 10 minutes. A short, capped queue of approval cards (a draft with "why now", a person with the
  reason they fit, a comment ready to paste) that ends with "That's today."

## Two worlds (Mercury-inspired)
- **Night** (`night #171721`, `night-raised #1e1e2a`, text `on-dark #ededf3`, `fog #c3c3cc`): onboarding
  and the side rail. Calm, centred, large light type, the breathing orb.
- **Day** (`canvas #fbfcfd`, `surface #fff`, `lavender #edecfb`, text `ink #28253b`, `ink-2 #554e7b`):
  the working views.
- **One saturated action** per view: `primary #5266eb` pill. Everything else is a translucent pill
  (`primary/10`) or ghost.
- **Type:** Inter at light weights: body 380, UI 420, headings 460–480. Hierarchy comes from size,
  never bold.
- **Shape:** cards at 12px, pills on actions, no heavy shadows. Lift comes from tone (lavender cards).
- **Status:** always words ("On", "Day 6 of 14", "Needs you"), never colour alone.

## Components (after 21st.dev)
| Use | Component |
| --- | --- |
| Onboarding progress | Segmented Progress Pill Stepper (`ProgressPill`) |
| Learning narration, skill logs | Onboarding Activity Feed (`Feed`) |
| Your 10 minutes | Approval Card pattern, capped, with an end |
| Skills | Switch rows (`Switch`) with status pills |
| The teammate's presence | `Orb`: breathes while it works |

## Views
- **Onboarding** (v2, 2026-10-25: ten screens in four chapters, on warm paper like the app):
  - **You:** paste the LinkedIn link, then "Is this you?".
  - **What you want:** goals (up to two, with what gets counted first), where people go next (each
    choice asks for its link and one follow-up; "Nothing yet" asks nothing), worries that reveal
    their remedy when tapped, then press and hold "deal".
  - **Your world:** topics, people they never miss and news sources; an optional LinkedIn sign-in
    (skipped when already signed in); their world mapped live as an orbit (finishes in the
    background).
  - **Your start:** where they stand (numbers in their order, what worked, two fixes), a first post
    (three ideas, the draft, a reaction that sets tone and voice), and the first week with their
    10-minute moment.
  - **Layout:** Spool and its bubble as one unit at the top (the bubble never repeats the heading),
    a serif question, then the actions right under the content, sticky only on phones. No
    background washes, no teammate picker. Dev preview: `?preview=<screen>` (see `src/dev/Preview.tsx`).

  Optional questions carry a "Why I ask" line and two skips. Skipped ones come back in your 10 minutes one at
  a time. State lives in `profile.onboarding_step`, `profile.skipped` and `profile.tone`.
- **Frame:** a night rail that collapses to icons (button or ⌘B, remembered), Spool at the top,
  Skills and two status icons at the bottom (LinkedIn browser and LinkedIn connection, each with a
  check or dash badge and a label). Spool's chat opens over the page. Phones get Home · For you ·
  Posts · Engage · More. One icon family (lucide) in the app; Spool replaces the orb everywhere.
- **Home:** one job with a finish line. "While you were away" (what Spool did since your last
  visit, in counts that open up to the reasons), then **Your 10 minutes**: everything Spool needs from
  you today as one short run (posts to approve, replies to post, people to decide on, one question),
  each queue capped at 3 / 5 / 5 / 1 so it always fits. A queue with more than today's share ends
  with a choice, like a photo app's review: **Keep going** or **Leave the rest for tomorrow**. The run
  ends at "You're all caught up" and what happens next. Before anything is published the card reads
  "Your first post is ready". Below: the Monday review card ("Looks good" approves the week's plan),
  and four tiles: Results, This week (a ring from the agreed rhythm; weeks count, not days; one quiet
  week a month never breaks the run), Next post, and Getting set up (3 of 6, gone when done). Only
  Home has a badge: the number of things in today's 10 minutes.
- **Teaching Spool:** each ready draft says why it was picked and has four chips (Shorter, More like
  me, Less salesy, Not my topic). The first three open it in the composer with that instruction sent;
  "Spool learned this week" shows what changed.
- **Results:** a card per published post, a day and three days on: people worth knowing first, then
  numbers against your own usual (once there are three earlier posts), why and what to try next,
  "Write another like this" and "This led to a conversation".
- **One nudge a day:** weekdays, half an hour before your posts, only when something is waiting,
  never twice; on, off or paused for a week in Personalization → Schedule.
- **Recommended:** your topics as tags (add one, or find one in a chat with Spool), posts ready to
  approve (previewed with your real photo and headline), and ideas to write.
- **Posts:** "Coming up" (real scheduled posts only), drafts, published, and posts that didn't go
  out. New post opens the composer.
- **Composer (full screen):** format and idea first, then the conversation with Spool on the left
  and the post itself on the right, updating live from its draft row; edit the text directly;
  approve to schedule. Phones: Chat and Preview tabs. Spool's replies can carry small widgets
  (a fenced `widget` block: pick a first line, Calmer / As is / Bolder, a few choices, or "Ready
  to go out Thu 08:30" with Approve); a used widget folds into a one-line receipt. Every change to
  the text keeps the previous version (v3 of 5, "Bring this back"), and selecting text in the
  preview offers Punchier, Simpler, Cut it, or Ask about this.
- **Engage, People:** today's five, with the same keep-going choice. A reply is posted by you (Copy
  and open, the default); "Post it for me" is a second choice that says LinkedIn may show
  tool-posted replies to fewer people.
- **Skills:** as before.
- **Personalization:** separate pages, like a settings app: the list beside the page on desktop,
  the list then the page on phones. Profile (LinkedIn card and time zone: a city search that shows
  the local time and offers the device's zone), voice (rules, import your posts, pick a voice, edit
  in chat), tone, brand kit, schedule, connections, about you, questions. Each page has an address
  (`#/personal/voice`).
- **Brand kit:** the person first (photo, name, a short line under it; or posting as the company),
  then logo mark and wordmark (with versions for dark slides; empty edges trimmed, light logos filed
  for dark slides automatically), one brand colour plus an optional second (text colours are
  computed for contrast; backgrounds derived and adjustable; contrast warnings in plain words),
  Google fonts (previewed in their own headline, checked for a bold weight), slide style, slide
  numbers, the swipe cue, and the last slide's ask. A live preview draws the first, an inside and
  the last slide from their newest draft with the renderer's own sizes. "Find my brand" on their
  website sends Spool to look; what it finds waits as Use / Skip rows and never overwrites. Saved
  to `profile.brand`; images live in `/me/brand/`.
- **Asking for access:** never a "connect your apps" list. When something needs the browser or
  LinkedIn, a sheet names the task, why it needs access, what you get, the way round it, and "Not
  now", then carries on with the task once access lands.

## Data
- All tables are private to the signed-in person.
- Lists are live via `useLiveRecords`. Because the change stream isn't always delivering, the app also
  re-reads:
  - after its own writes;
  - when a teammate turn ends;
  - when the tab comes back;
  - on a 45 s heartbeat;
  - every few seconds only while a screen waits on the teammate (bounded).

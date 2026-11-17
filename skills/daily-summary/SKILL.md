---
name: daily-summary
description: "The person's short morning summary of yesterday's engagement: how many comments went out and whether every one showed, who replied, who showed interest and what's been done about each, what the teammate learned from their edits, and the decisions waiting for them. Written from the tables only, no browser. Saved as a `reviews` row (`kind: daily`) the app shows on Home, and sent as one message. Use in the [morning] run when engage is on, and when they ask how yesterday went."
---

# The daily summary

One page they can read in a minute, every morning. It answers four questions: is it working, who is
talking to me, what did you learn, and what do you need from me. People first: the summary exists so
that nobody who showed interest waits a day for an answer.

Nobody is watching this run: never ask anything. Use no browser: everything comes from the tables.

## 1. Gather (yesterday, on their clock)

- **Comments:** `engagements` with `status: "commented"` and `done_at` yesterday. Count them, how
  many were `posted_via: "auto"`, how many have `checked_visible: true`, and how many are thread
  replies (`lane: "reply"`).
- **Reach and replies:** from `outcome` on the last 7 days of comments: likes, replies, author
  replies, impressions. Name the authors who replied yesterday.
- **Stops:** `profile.browser_status` (`checkpoint`?), the engage skill's `state` and `status_text`,
  and any `activity` rows with `result: "warning"` yesterday.
- **People:** the `people` rows with a `signal`, newest `signal_at` first, and their `messages`
  (`dm` / `connect`) with their status. Also `engagements` replies to them (`method` `thread` or
  `own_post`) still `proposed`: someone is waiting on an answer.
- **Waiting for them:** `engagements` still `proposed` (auto-post off), `messages` in `draft`,
  `drafts` in `ready`.
- **Learned:** `facts` with `section: "engage"` created or updated yesterday.

## 2. Write it

Plain words, short lines, no em dashes, no emoji, names and links where they help. Use this shape
and leave out any section with nothing in it:

```markdown
## Status
- 31 comments yesterday, 12 of them on their own (auto-post). All 31 showed after posting.
- 5 authors replied: Ana Ruiz, Tom Ito, ... 2 more liked yours.
- Nothing stopped. (Or: Paused since 14:20: LinkedIn showed a check. Open your LinkedIn browser
  from Home and finish it; I'll pick up from there.)

## People
- **Wants to try it:** Dana Price (https://linkedin.com/in/...) said "I'll take a look" on your
  comment about onboarding. I answered in the thread; a DM is waiting for your OK.
- **Asked a question:** Omar K. asked how the review step works. Answered at 11:05; a connection
  note is waiting for your OK.
- **Waiting on a reply from you:** Ana Ruiz agreed and added a point. My reply is drafted; it needs
  to go out today to land.
- **Still open:** Jonas B. (said he'd look, 3 days ago, DM sent, no answer yet).

## Learned from your edits
- Keep comments to two sentences (you cut the third line from 4 comments).

## For you
1. Approve 2 DMs and 1 connection note in People.
2. 8 comments are waiting in Engage. (Only when auto-post is off.)
```

Rules for People:
- Hot first, then questions, then authors waiting on a reply (with how long the thread stays
  worth answering: about 24 hours), then anyone big (10K+ followers) who replied, then the still-open
  list (anyone who showed interest in the last 14 days with no DM sent, no answer, or no next step).
- For each: their name with a link, their words in quotes (short), what you did, and what's next.
- Never list someone twice. Never invent a step that didn't happen.

## 3. Save and send

1. Write one `reviews` row: `kind: "daily"`, `day` (yesterday, YYYY-MM-DD), `summary` (one line,
   e.g. "31 comments, 5 author replies, 2 people want to try it"), `body` (the markdown), `numbers`
   (`{comments, auto, shown, author_replies, replies, interested}`), `status: "new"`. One row per
   day: if it exists, update it.
2. If anything happened or anything waits for them, send **one** `message_user`. Title: the most
   important line ("2 people want to try it", "Paused: LinkedIn showed a check", "31 comments, 5
   replies"). Body, 2 to 4 short lines: the people first, then what waits for them, then "The full
   summary is on Home." Never the same title two days running.
3. A quiet day (nothing posted, nobody replied, nothing waiting): save the row, send nothing.

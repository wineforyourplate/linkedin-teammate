---
name: follow-up
description: "Keep every new connection's conversation moving: read the person's recent connections and inbox, bucket each person (new, waiting on you, day 4, day 10, closed), surface replies they owe first, draft one message per due person in their voice for approval, send approved ones at a human pace, and stop the moment someone replies. Use for the follow_up skill in a session, its first run, or when asked who to follow up with."
---

# Follow up

A connection is only the start. A first message that's about them, one follow-up that adds something,
then you stop.

Load `linkedin-browser` first. Ask `function_allowance` `{skill: "follow_up", action: "message"}`
before sending.

## 1. Read the state

- **Recent connections:** My Network → Connections, sorted by recently added. Look at the newest 30.
  Anyone matching a `people` row in `invited` → `accepted`, `accepted_at`.
- **Inbox:** `/messaging/`. For each `people` row in `accepted` or `messaged`, find the thread and note
  **who wrote last** and when.
  - They wrote last: they replied. Set `replied`, `next_step`: "Reply: <one line on what they said>".
  - Replies are listed first in the app as "waiting on you".
- Message requests and InMail sit in separate filters. Check them too.

## 2. Bucket each person

| Bucket | When | What you draft |
| --- | --- | --- |
| **waiting on you** | they wrote last | a reply suggestion, for them to edit and send |
| **new** | accepted in the last 1–2 days, no message yet | the first message |
| **day 4** | you wrote last, 4 days ago, no reply | one follow-up that adds something new |
| **day 10** | you wrote last, after one follow-up, 10 days ago | at most a short close-the-loop; then stop |
| **closed** | declined, asked not to be contacted, said not interested, or the thread ended | nothing, ever again |

Out of office means pause, then try again after the date. Never more than one message per person in
48 hours.

## 3. Draft

Write one `messages` row per due person:
- `kind`: `first`, `followup` or `reply`;
- `body`: under 300 characters, at most one question, in their voice, with no em dashes (—);
- `status: draft`.

**First message:** reference what you connected over (the note, their post, their comment). Give
before you ask: an observation, a resource, a useful number. One small ask at most, and no calendar
link. No pitch unless they asked.

**Follow-up:** must add something new (a relevant post, a number, an answer). Never "just checking in"
or "bumping this".

Update the person's `next_step` in plain words: "First message ready for your OK".

## 4. Send (approved only)

For each message with `status: approved`, within the allowance:
1. Open the conversation (their profile → **Message**, or the existing thread).
2. Make sure the composer is empty. Type the approved body in chunks, read it back, and send.
3. Confirm it appears in the thread as sent.
4. Set the message to `sent`, `sent_at`, and the person to `messaged`, `last_message_at`. Log
   `activity` `{action: "message", detail: "Sent your first message to …"}`.

If the composer is occupied, the send is rejected or you can't confirm it: set the message to
`failed` with the reason. Don't retry blind.

## 5. Stop rules

- Any reply stops the sequence for that person.
- "Not interested" closes them for good.
- After the day-10 message: closed.

`status_text`: "3 replies waiting on you · 5 first messages ready".

**Works better with:**
- Gmail: follow up by email when they share an address;
- Calendar: stop when a meeting is booked, and offer your booking link when they ask;
- your CRM: log every reply.

---
name: weekly-review
description: "The weekly 1:1: what happened on the person's LinkedIn this week, what worked with evidence, next week's plan and one recommendation, sent as one short message. Reads drafts, people, engagements and activity; reads post numbers in their browser when signed in. Use for the [weekly] run or when asked how things are going."
---

# The weekly 1:1

Short, honest, useful. Like a good hire's Monday note, not a dashboard.

1. **Numbers.** If the browser is signed in, read each post published in the last 14 days on its
   page: reactions, comments, reposts, and impressions when LinkedIn shows them (load
   `linkedin-browser`; a few page loads only). Write them to the draft's `reactions`, `comments` and
   `impressions`.
2. **What happened:** posts published, people found, invited, accepted (and the rate), messages sent,
   replies, warm-up day, and the comment scorecard (`engage` §8): comments made, how many got a like
   or a reply, author replies, and the method and author size that worked best.
   Lead with what they count first (`profile.kpi_order`: profile visits, link clicks, impressions,
   followers), in that order, against their starting line (`profile.stats`) when you have it. Say
   who joined or left their world (`world` rows decided this week) and how many suggestions wait.
3. **What worked:** the best post and why, in one line with the number. Compare like with like (same
   format, same age), never across formats.
4. **Next week:** which ideas go in which slots. Name them.
5. **One recommendation** (`recommend` skill), if one is due.

**Also write it to the app**, as one `reviews` row (the Home card, with "Looks good" to approve the
week's plan in one go):

```json
{"week_of": "<Monday of this week, YYYY-MM-DD>",
 "summary": "2 posts out, and the client-margins one did best.",
 "numbers": {"posts": 2, "reactions": 84, "comments": 19, "people_found": 12, "accepted": 3, "conversations": 1},
 "best": {"draft_id": "<id>", "title": "Client margins", "line": "61 reactions, 14 comments, your most yet", "why": "A number in the first line."},
 "plan": [{"draft_id": "<a ready draft>", "title": "The 3-day close", "slot": "<ISO, one of this week's slots>"}],
 "suggestion": "Engage on posts: your account is warm enough now.",
 "status": "new"}
```

- `summary`: one sentence, their week in plain words. It's the card's headline.
- `numbers.conversations`: posts they marked "This led to a conversation" this week.
- `plan`: this week's posting slots (from `posting_days`, `posting_time`, `timezone`), each with a
  `ready` draft. Write drafts first if there aren't enough ready ones. Only `ready` drafts: approving
  the plan approves exactly these.
- Compare with their own earlier weeks only. Never shame a quiet week: say what's planned instead.
- Mark earlier `new` reviews `dismissed` so only this week's shows.

Send it with `message_user`, 6–10 lines, plain text, no tables:

```
Your week on LinkedIn
2 posts out. The one on client margins did best: 61 reactions, 14 comments, your most yet.
Warm-up is on day 9 of 14, no warnings.
I found 12 people; you approved 7; 3 accepted.
Next week: Tue the 3-day close carousel, Thu the late-invoices post.
One suggestion: Engage on posts. Your account is warm enough now, and two people you'd like to know comment daily.
```

Skip the week if `profile.weekly_review` is false.

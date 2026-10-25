---
name: research-topic
description: "Research what people are saying right now about one of the person's topics: what's landing, what's falling flat and what people are asking, from the last 30 days only, every item dated and linked. Writes the result onto the `topics` row and suggests post ideas that cite it. Use for [research] runs (a topic was added, the weekly refresh), before suggesting ideas from a topic whose research is over 7 days old, and when they ask what's happening in a topic."
---

# Research a topic

Ideas that sound right aren't enough. The person wants to know what is actually being said this month,
by whom, and how it landed, so every idea you offer can point at something real.

## The recency rule

- **Only items you can date inside the last 30 days count.** Prefer the last 14.
- Date every item from the page itself, an API timestamp, or the post ID (below). If you can't date it,
  drop it. Never guess a date, a number or a quote.
- Engagement numbers are as of when you read them.

## Where to look, and how

Budget per topic: about 6–8 searches and 6–10 page reads. Narrate as you go with `activity` rows
(`skill: "research"`, `action: "read"`, e.g. "Reading this month's Hacker News threads on AI agents").

1. **Hacker News** (the most reliable): fetch
   `https://hn.algolia.com/api/v1/search?query=<words>&tags=story&numericFilters=created_at_i><unix time 30 days ago>,points>20`.
   Every hit has an exact timestamp, points and comment count. Read the best thread with
   `https://hn.algolia.com/api/v1/items/<id>` for what people argue about and ask.
2. **X**: `web_search` restricted to x.com finds posts but ignores dates. A post's date is in its ID:
   milliseconds since epoch = `(id >> 22) + 1288834974657`. For likes, replies, reposts, bookmarks and
   views, fetch `https://api.fxtwitter.com/<user>/status/<id>` (x.com itself won't load).
3. **LinkedIn**:
   - If their browser is signed in, use content search (Posts, "Past week", sorted by latest). Load
     `linkedin-browser` first; page loads count toward `function_allowance`.
   - Otherwise use `web_search` restricted to linkedin.com/posts. A post's activity ID holds its date:
     milliseconds since epoch = `activity_id >> 22`. Public post pages show reactions, comment
     counts and top comments.
4. **News and blogs**: `web_search` to discover, then keep only pages with a visible date in the window.
5. **Reddit**: search tools are blocked. If their browser is available, open
   `https://www.reddit.com/search/?q=<words>&t=month&sort=top` there and read the top threads.
   Otherwise skip it and say so in the summary.

## What to write

Sort what you found into three lists, up to 3 items each:
- **working**: angles, hooks or formats that got real traction (cite the numbers);
- **not**: claims or styles that fell flat or drew backlash (including low traction for the same claim);
- **asking**: questions and worries people raise in the comments.

Each item is `{source, date (YYYY-MM-DD), metric, text, url}`. `text` is one line in your words; quote at
most a short phrase. Then write on the `topics` row:
- `signals`: `{working: [...], not: [...], asking: [...]}`;
- `angles`: 2 post angles `{title, from}`, each tied to the signal that suggests it;
- `summary`: one plain sentence on what's live in this topic this month;
- `researched_at`: now, and `research_status: "done"`.

Set `research_status: "running"` when you start. On failure keep what you had, set `"failed"`, and
write one `activity` row with `result: "warning"`.

## Then suggest posts

Write up to 2 `drafts` with `status: idea` from the angles:
- `title`: the angle;
- `why_now`: the signal, with its source and date ("A thread with 805 points on Hacker News, 12 Oct,
  argues …");
- `source`: the URLs.

Never offer an idea you can't point to a signal or to something the person told you. Never copy another
person's post, and don't name people or companies in a draft unless the person asks to.

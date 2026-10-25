---
name: engage
description: "Join the right conversations on LinkedIn, as two jobs on the person's own schedule: Replies (cheap, every few hours: read back their comments, and draft replies to people who commented on their posts or answered their comments) and Finding (up to 3 runs a day: find fresh posts from the people in their world and draft a batch of comments that take a stand). Posts the batch they approve, one by one. Keeps their world (the `world` table: the people whose posts it watches, and people it suggests for the person to add) and the scorecard. Use for engage-replies, engage-find and engage-post workflow tasks, [engage] find, [onboarding] world, [world] map, [world] add, and when asked who to engage with or how comments are doing."
---

# Join conversations

For an account under ~10K followers, good comments in the right threads bring more profile visits
than posts do. What works, from running this by hand (20 comments, read back a day later):
- **Conversations come from smaller authors.** Authors under ~35K followers replied to 5 of 9
  comments, usually within 15 minutes. Authors with 100K+ followers replied to none of 11.
- **Big creators are for reach, and only when you're early.** A comment in a thread that already
  had 100+ comments got 5 to 10 impressions. One early on a post that later grew got 40 to 90.
- **The best comment of all** was early, on a small founder's launch post that grew: 252
  impressions, the author replied, and so did others.
- **A clear position draws replies,** including pushback. Reply when someone answers.

Load `linkedin-browser` first. Ask `function_allowance` before each batch: `{skill: "engage",
action: "page_load"}`, `"like"` and `"comment"`. Log every action to `activity`.

## Settings (the `engage` row in `skills`)

`settings` holds everything the person chose. Never change what they set.
- `replies`: `{on, every_hours, last_run_at}`. The replies job, inside their working hours.
- `runs`: up to 3 `{key, label, time "HH:MM", size, on, last_run_at}`, the finding runs. Everything
  is off until they switch it on in the app. The `engage_clock` function decides what's due.
- `mode`: `"approve"` (default: they approve a batch in one go and you post it, one by one) or
  `"copy"` (they post each one themselves with Copy and open; you never post).
- Their world is not in settings: it's the `world` table (see Their world).
- `sightings`: `{"<author url>": {name, runs: [batch labels], beside: [watched urls], last}}`, the
  authors you came across but haven't suggested yet (see Suggestions). Keep at most 150; drop any
  older than 30 days.
- `mention`: `{name, url, when}`, a page to tag (see Writing).
- `skip`: people or topics never to engage with.
- `running_since`, `last_run_at`: set by the clock. Clear `running_since` when a run ends.
- The skill row's `caps` (`{comments, likes}`) are their daily limits; `function_allowance` enforces
  them under fixed ceilings.

## Replies (`task: engage-replies`): cheap, every few hours

Directed work: people already talking to them. Budget: about 8 page loads. Nobody is watching;
never ask anything.

### 1. Read back: one page

Open their own comments page, `https://www.linkedin.com/in/me/recent-activity/comments/`, and press
End until it reaches comments older than 7 days (two or three presses for a day's batch). Under
each comment it shows "N reactions · R replies · N impressions" (singular when it's 1: match
`impressions?`). That one page covers every
comment. For each `commented` row from the last 7 days, match the comment (same post and text) and
update `outcome`, keeping what's there:
`{"likes": n, "replies": n, "author_replied": true|false, "repliers": ["Name, headline"],
"impressions": n, "checked_at": "<ISO>", "note": "..."}`.

For names, open `https://www.linkedin.com/notifications/` once: it lists who reacted or replied, but
keeps only the latest ~10, so treat it as a bonus, never the count. Open a post only for comments
whose reply count went up since the last run: that's where you read the new replies, check whether
the author replied, and draft counter-replies. Stop updating a row once it's 7 days old.

**Counter-replies.** For each new reply to their comment from someone else, add a row:
`method: "thread"`, `post_url` (the same post), `author_name` (the replier), `reason`
(`"<Name> replied to your comment: \"<their words, short>\""`), and a `comment_draft` of 100–250
characters that answers their actual point. Agree only if you add something; otherwise push back.
No question tacked on.

### 2. Comments on their own posts

Open each of their posts from the last 7 days (`/in/me/recent-activity/all/`, then the posts that
show new comments since `replies.last_run_at`). For every comment from someone else that they
haven't answered and that has no `engagements` row yet, add one:
- `method: "own_post"`, `post_url` (their post), `author_name`, `author_headline`, `author_url`,
  `author_photo`;
- `reason`: `"<Name> commented on your post: \"<their words, short>\""`;
- `comment_draft`: a reply of 80–250 characters that answers them like a person would. Thank only
  when it's earned, add one concrete thing, and invite the next line only if it's natural. No em
  dashes.

Replies on their own posts in the first hour do the most for the post's reach, so these come first.

### 3. Tell them, if anything is waiting

If you added rows, one `message_user`: "<N> people are waiting on a reply" (plain words). If nothing
new, stay silent. Clear `settings.running_since`.

## Finding (`task: engage-find`, with `since`, `hours`, `size`, `label`): the expensive job

The browsing job: the remote browser runs for most of it, so follow `linkedin-browser` §10 (read
fast, write slow). Budget: about 25 page loads and 15 minutes. Nobody is watching; never ask
anything. If the replies job hasn't run in the last 3 hours, do its step 1 first.

### 1. Find posts published since `since`

Strongest first. Stop when you have about twice `size` candidates.
1. **Their world, daily posters first.** Read the `world` rows with `status: "watching"`. Open each
   `cadence: "daily"` person's recent activity (`<url>/recent-activity/all/`) and take posts newer
   than `since`. About 80% of good posts come from here. Re-scan weekly and monthly posters only on
   the first run of the day, and skip anyone whose `last_post_at` is within the last day when their
   cadence is weekly or monthly. Update the row's `last_post_at`, `last_seen_at` and `photo` (the
   profile image's `src`) as you go. A row with no `url` yet is someone they named: find them
   first (see Their world).
2. **Small senior authors posting right now:** content search on their topic words, "Past 24
   hours", sorted by latest, **with an author job-title filter** (`authorJobTitle="founder"`, or the
   titles of their buyers: "head of", "VP", "CTO"). Sorted by latest without that filter, it's
   spam. With it, it finds founders and execs whose posts are 1–15 minutes old: the authors who
   reply.
3. **Their 1st-degree connections and people they follow:** "Posts by: 1st connections" or
   "following", past 24 hours, plus their topic words. Quiet on weekends.
4. **One trend search:** what 3 or more people in their world posted about this week, searched once
   ("Past week", relevance).
5. **The peer orbit, weekly:** competitors' and similar products' company pages, their founders and
   team, and "<category> past 24h" for paid-partner promos. Their authors reply.

Skip these: keyword search sorted by latest *without* an author filter (job posts and spam),
people search by keyword (agencies), and the home feed (ads and day-old posts).

### 2. Filter, in under 30 seconds a post

- Keep posts with **5 or more reactions**, or by a founder or C-level at a relevant company, or by
  a known name in their world. Small senior authors reply fastest.
- Prefer threads with **fewer than ~50 comments**, or posts **under ~3 hours old**. A comment on a
  150-comment thread is invisible unless it gets replies.
- Drop their own posts, anything older than `since` (except posts from their world under 18 hours),
  authors they commented on in the last 3 days, anything on `skip`, and threads where the only
  possible comment is praise.
- Don't deliberate. A missed good post costs less than ten minutes of deciding.
- As you go, note candidates for their world in `settings.sightings`: each author not in `world`
  whose post passed this filter and had replies (add this run's batch label to `runs`), and the
  names in the "More profiles for you" rail of any watched person's profile you opened (add that
  person's url to `beside`). See Suggestions.

### 3. Pick the batch (`size`, default 10)

Then aim for this mix (scale it to `size`):
- **5 small senior authors** (about 1K–50K followers: founders, execs, builders in their space),
  from trends, launches, the peer orbit and 1st-degree connections. This is where conversations
  happen.
- **3 rising posts** from mid-size creators (50K–250K), under 2 hours old or under 30 comments.
- **1 big creator** (250K+), only under 1 hour old or under 30 comments.
- **1 peer-orbit post.**

Never take a thread that already has 100+ comments. Lean toward what the scorecard says works for
this person (§8). The scorecard beats this starting mix after two weeks.

### 4. Write a row per post

`post_url`, `author_name`, `author_headline`, `author_url`, `author_photo` (the author image's
`src`, for the app), `author_followers`, `post_reactions`,
`post_comments`, `posted_at` (now minus the age on the card), `excerpt` (up to 600 characters, cut
at a sentence), `reason` (one line: why this post, and what the comment adds), `method`
(`watchlist` for a post from their world, `first_degree`, `trend`, `peer_orbit`, `top_comment`; `thread` and `own_post` come from
the replies job), `story` (below),
`should_like: true`, `comment_draft`, `status: proposed`, `batch: "<YYYY-MM-DD> <run label>"`, and
`drafted_by`: your model's name if you know it, otherwise `"teammate"`.

### 5. Suggest, refresh, tell them once, and finish

Record suggestions from this run (see Suggestions). If it's the week's first run, do the weekly
refresh too (see Their world). Then one `message_user`: "<N> comments ready for your approval."
Plain words, no em dashes. Mention suggestions only if there are new ones ("and 3 people to add
to your world"). Then clear `settings.running_since`, and set `status_text` ("10 waiting for you ·
4 of yesterday's 10 got a reply") and `last_run_at`.

## Writing a comment

200–350 characters, 2–4 sentences, in their voice. **The first sentence takes a stand**, one of:
- **disagree:** what the author has wrong or is missing, and why, from their experience;
- **push it further:** take the point one step past where the post stopped, with a number, a case
  or a consequence;
- **"we hit this":** how they or their company solved the same problem, concretely, and why it
  worked better.

Never:
- agreeable openers ("Great post", "Love this", "So true", "This resonates", "Spot on");
- restating the post;
- a soft question tacked on at the end for engagement;
- a sales pitch, a link, or an emoji opener;
- an em dash (—). Use a comma, a colon or a full stop.

Read the top 10 comments first, and take a stand nobody there has taken.

**Stories.** Their story bank is the `facts` rows labelled "Story: ...": real things they or their
company built or did. Before writing, read `story` on their last 10 commented rows. A "we hit this"
comment uses a story that:
- fits the post (a story bent to fit is the wrong story);
- wasn't used in either of the last 2 comments;
- hasn't been used more than once in the last 10.

Write its label (without "Story:") into `story`. If none fits, take one of the other two stands. If
the bank has fewer than 6 stories, add one `facts` question: "Tell me something your team built or
fixed this month."

**Tagging a page** (`settings.mention`): write `@<name>` where the tag goes. `when: "relevant"`
(the default) tags only comments that say how they or their company do something; `"always"` tags
every comment.

## Posting the approved batch (`task: engage-post`, with `ids`)

The clock has already set these rows to `posting`, in the order they were approved. One by one:
1. Re-read the row. Go on only if it's still `posting`. Ask `function_allowance` for a comment; if
   none is left today, set the rest back to `approved` with `error: "Today's comment limit is
   reached. I'll post these tomorrow."` and stop.
2. Open `post_url`. Like the post if `should_like` and it isn't liked yet. For a `thread` or
   `own_post` row, find the comment or reply from `author_name` and use its Reply button. Otherwise
   use the post's comment box.
3. Type `comment_draft` exactly as it is now (they may have edited it), at a human pace. For a tag,
   type "@" and the first word of `mention.name` (a "." breaks LinkedIn's search), then pick the
   entry whose link matches `mention.url`. The tag has no trailing space, so start the next text
   with one.
4. Post it. Confirm it shows under the post. Read "N impressions" if it's there.
5. Set `status: commented`, `done_at`, `posted_via: "teammate"`, and `comment_url` if you can copy
   it. Log `activity` `{action: "comment", target: post_url}`.
6. Wait a random 1–4 minutes before the next one.

Never change a word they approved. On any warning, checkpoint or "unusual activity" dialog (check
dialogs and banners only; commenters write "checkpoint" too), stop at once. Set the rows not yet
posted back to `approved` with `error: "Paused: LinkedIn showed a warning"`, set the skill to
`needs_you`, and `message_user` once. One attempt per row: on an error, set `failed` with a plain
`error` and go on to the next.

In `mode: "copy"` you never post: rows stay `proposed`, and the person posts each one from the app.

## Their world (the `world` table)

One row per person or page whose posts you watch for them: `name`, `url`, `photo`, `headline`,
`bucket` (`voices`: big reach in their topics; `deciders`: they buy, hire or back; `news`: they write
about it first; `builders`: shipping in their space; `peers`: doing what they do), `cadence` (daily,
weekly, monthly, from their last 5 posts), `followers`, `why` (one line), `status`, `source`,
`last_post_at`, `last_seen_at`, `seen_count`, `added_at`, `decided_at`, `removed_reason`.

**Nobody becomes `watching` without the person.** A row is `watching` only when:
- they asked for the first map (onboarding, or "Map my world" in the app) and you wrote it then;
- they named the person (`source: "you"`, a name or a link they gave you);
- they pressed Add on a suggestion (the app sets it).

Everything else you find is `suggested`, with a `why`. Never move a row to `watching` yourself, and
never delete a row: use `status: "removed"`. It's built for this person: a product manager's world
starts from the product people they read and the products they compete with, a founder's from their
category and buyers. Never copy another person's world.

### The first map (`[onboarding] world`, `[world] map`)

They're waiting for faces, so write rows as you find them (the app shows them live), and narrate
with `activity` rows (`skill: "world"`, `action: "read"`, `page_loads`, e.g. "Found 12 people so
far"). Set `profile.world_status: "mapping"` at the start. Ask `function_allowance` for
`{skill: "engage", action: "page_load", count: 50}` first: it answers even before engage is on,
because reading only spends the shared page budget. Never like, comment or follow during the map.

1. **Start from what they gave you:** the `world` rows with `source: "you"` (their seeds; find each
   one's link first if it's missing), their `topics`, their competitors and similar products
   (`facts` company), and `profile.news_sources`.
2. **Find people:**
   - Signed in: the senior-authors search for each topic (`linkedin-browser` §10), each seed's
     profile and its "More profiles for you" rail (about 10 seconds for 5 names), one hop further
     from the best ones, and a competitor's company page and its People tab.
   - Signed out: never open LinkedIn in the browser. Use `web_search` (`site:linkedin.com/in
     "<topic>"`, `"<seed name>" linkedin`) and keep only people whose profile link you can see.
3. **Keep:** 10K+ followers, or a founder or C-level title in their space, or someone whose posts in
   their topics get real replies. Tag each with `bucket`, `cadence`, `followers`, `photo`,
   `headline` and a one-line `why`. Write `status: "watching"`, `source: "map"` (keep `"you"` on
   seeds), `added_at`.
4. **Size:** aim for 40 to 60 across the five rings, at least 3 per ring when you can. 25 good
   people beat 60 thin ones.
5. Finish: `profile.world_status: "done"` and `world_refreshed_at`. If you stop early (budget, a
   warning), keep what you have and still set `"done"`; set `"failed"` only if you found nobody.

### Suggestions (every finding run)

Cheap: use only what the run already opened. Suggest someone when:
1. **They talked to them:** an author or commenter replied to one of their comments, or they
   commented on that author's posts twice in 14 days (`engagements`). `source: "replied"`.
2. **They kept showing up:** an author whose post passed your filter (§2) and had replies, in 2 or
   more different runs (`settings.sightings[url].runs`). `source: "repeat"`.
3. **LinkedIn puts them next to their people:** someone in the "More profiles for you" rail of 2 or
   more watched people (`settings.sightings[url].beside`), read only on profiles you opened anyway.
   `source: "linkedin"`.

For each, create (or update) a `world` row: `status: "suggested"`, `source`, `seen_count` (runs or
watched people so far), `last_seen_at`, `bucket`, `followers`, `photo`, `headline`, and a `why` they
can judge in one read ("Replied to your comment on agent evals", "Turned up in 3 of your runs, with
real replies", "LinkedIn shows them next to Asha and Tom"). Then drop them from `sightings`.

Never suggest: anyone already `watching`; anyone they removed (`removed_reason: "you"`); anyone
they passed on (`"not_now"`) in the last 30 days; their own profile. At most about 5 new
suggestions a week (count the `world` rows you created as `suggested` in the last 7 days),
best-evidenced first. A suggestion nobody answered in 2 weeks drops off: `status: "removed"`,
`removed_reason: "expired"` (it can come back later through the rules above). The app shows
suggestions on Your world and from Spool's corner; the person decides.

**Size (open issue).** `watching` has a soft size of about 60. Suggestions grow it slowly, but
nothing shrinks it except people going quiet, so after months it could reach a few hundred, too
many to read or judge. Not built yet: past 60, the weekly refresh should propose removals for the
person to approve, inactive people first, then people they never engaged with. Until then, when
it passes 60, say so in the weekly review and name the quietest few.

### The weekly refresh (the first finding run of the week)

When `profile.world_refreshed_at` is before this Monday, spend about 10 page loads on it:
- Anyone `watching` whose last post is more than 30 days old (from `last_post_at`, or their activity
  page when it's unknown): `status: "removed"`, `removed_reason: "inactive"`. Never delete them.
- Update `cadence`, `followers` and `photo` on the rows you open.
- A removed row that posts again turns up as a suggestion through the rules above, not on its own.
- Set `world_refreshed_at`.

### Adding one person (`[world] add <id>`)

They pasted a link in the app; the row exists as `watching`. Fill in `name`, `headline`, `photo`,
`bucket`, `cadence`, `followers` and a `why` from one page load (signed out: one `web_search`). Keep
`status` and `source`.

### What it costs

| Job | Page loads | Time |
| --- | --- | --- |
| The first map | 30 to 50 | 10 to 20 minutes |
| The weekly refresh | about 10 | a few minutes |
| Suggestions | none extra | none |
| Adding one person | 1 | under a minute |

Follow `linkedin-browser` §10 (read fast, write slow): open by URL, read each page once with one
extractor, and ask `function_allowance` for the page loads before you start.

## The scorecard (§8)

A comment is **engaged** when `outcome.likes > 0` or `outcome.replies > 0`.

| Measure | How |
| --- | --- |
| Comments made | `commented` rows in the period |
| Engagement rate | engaged ÷ comments made |
| Replies, author replies | sums from `outcome` |
| By `method` | engagement rate and author-reply rate |
| By author size | under 10K, 10K–100K, 100K–1M, 1M+ (`author_followers`) |
| By thread size | under 50 comments vs more (`post_comments`) |
| By `story`, by `drafted_by` | engagement rate |

The weekly review reports it. When a `method` or author size is in the bottom two two weeks
running, pick less of it.

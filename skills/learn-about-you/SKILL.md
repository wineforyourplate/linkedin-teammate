---
name: learn-about-you
description: "Get to know the person and their company: find their LinkedIn profile from a link, then (in the background once they confirm it) read their profile, recent posts and company website, and write what you learned as `facts` with sources, plus questions for what you couldn't find. Also writes where they stand (`profile.stats`: their numbers, best post and two fixes) and a guess at where their posts should send people. Also proposes three voices when they ask you to find one. Narrate each step as an `activity` row (skill: learning) so the onboarding screen shows it live. Use for [onboarding] find-profile, [onboarding] voices, [learn], the numbers in [onboarding] world, and whenever they ask what you know about them or to refresh it."
---

# Learn about the person

Everything the teammate does is only as good as what it knows: who they are, what they sell, to whom,
how they sound. You learn it once, show it back so they can correct it, and keep it current.

## 1. `[onboarding] find-profile <url>`: "Is this you?"

The person pasted their LinkedIn link and **moved on**. This runs in the background; the app shows
"Is this you?" the moment you write their name. Be quick (under 60 seconds) and write early.

1. If their LinkedIn connection works (`LINKEDIN_GET_MY_INFO` answers) and its `profileUrl` or
   `vanityName` matches the link, use it: it has the exact name, headline and photo. Otherwise, if their
   browser is signed in (`profile.browser_status = "signed_in"`), open the profile there and read the
   top card. Otherwise run **one** `web_search` for the slug (e.g. `"jane-doe-4b2a1" linkedin`).
   LinkedIn's result title is "<Name> - <Headline> | LinkedIn", and the snippet usually carries the
   location and company.
2. **Write to `profile` immediately** with what you have: `linkedin_name`, `first_name`, `headline`,
   `location`, `role`, `company_name`, and `photo_url` if you have it. Leave a field empty rather than
   guess.
3. Only then, optionally, try **one** fetch of the public profile for `photo_url`. LinkedIn usually
   shows a login wall. If the fetch fails or hits the wall, **don't retry**.
4. Write one `activity` row: `{skill: "learning", action: "read", detail: "Found your profile: <name>, <headline>"}`.
5. If you found nothing, write an `activity` row saying so (`result: "warning"`) and stop. The app lets
   them go ahead with the link anyway.
6. Do **not** set `profile_confirmed`: the person does that with "That's me".

## 2. `[learn]`: the background read, after they confirm

Narrate every step as an `activity` row (`skill: "learning"`, `action: "read"`, a `detail` the person
would understand, `page_loads` for browser pages). The onboarding screen shows these live, one by one.
Set `profile.learning_status = "running"` at the start.

1. **Their profile** (browser if signed in, else public sources). Cover headline, About, current role,
   experience, featured items, custom URL, follower and connection counts, creator mode, and the
   banner (describe it). Load `linkedin-browser` first if you use the browser.
2. **Their recent posts.** In the browser: their activity page, the last 10–20 posts, with text,
   format, date, and reactions and comments when shown. **Without the browser, use public sources:**
   - `web_search` for `site:linkedin.com/posts <vanity name>` and `"<their name>" linkedin post`;
   - fetch each public post URL once (`linkedin.com/posts/...` pages often show the full text logged
     out; skip any that hit a login wall, don't retry);
   - read up to 10.

   Also use any `voice` fact with source "you pasted it": those are posts they chose, so weigh them
   most. If you still have no posts, don't ask for them in a question: the app's Home shows a voice tile that leads to
   importing them (`profile.voice_import: "todo"`) with an import and an upload. Set `voice_import`
   to `"todo"` if it's empty and `voice_mode` is `mine`.
3. **Their company.** If `profile.website` is empty, find it: the headline or `company_name` usually
   names the company ("Co-Founder at Acme.io"); one `web_search` for the company name confirms the
   site. Save it to `profile.website`. Then fetch `profile.website` (and its pricing, customers and about pages if they
   exist). Note what it sells, to whom, the stage, proof (customers, numbers) and the brand colours and
   fonts from its CSS.
4. **Write `facts`.** Use one row per fact, with `section`, `label`, `value`, `source` (`"your
   LinkedIn profile"`, `"your website"`, `"your posts"`) and `confidence` (0–1):
   - `you`: role, background, what they're known for, location.
   - `company`: what it does, who for, stage, proof they can name (default: none cleared, ask first).
   - `audience`: who they want to reach. Infer it from the company and their goal.
   - topics: 3 pillars worth posting about. Write each as a **`topics` row** (not a fact): `name` (2–6
     words, e.g. "AI teammates, not tools"), `why` (one line: why it's theirs), `source` (`company`,
     `profile` or `posts`), `status: active`. Skip any that already exist. Adding a topic starts its
     research on its own.
   - `voice`: 3–6 rules seen in their real posts, each with a short quoted example, e.g. "Opens with
     a number". With no posts, write none. If they picked a voice (`source: "you picked it"`), keep it;
     your rules refine it.
   - `brand`: primary colour, secondary colour, fonts, logo URL (for carousels).
   - `preferences`: anything they told you.
5. **Where they stand (`profile.stats`).** The onboarding shows it a minute or two after they
   confirm, so write what you have as soon as you have it, and fill in the rest later:
   `{"followers": 3442, "profile_views_week": 61, "impressions_week": 2400, "best": {"title": "Your
   post on <subject>", "numbers": "8,069 impressions, 20x your usual", "why": "<one line>", "url":
   "<link>"}, "fixes": ["<one line>", "<one line>"], "read_at": "<ISO>", "from": "<where the numbers
   came from>"}`.
   - `followers`: from their profile (the top card, or a search snippet's "3,442 followers").
   - `profile_views_week` and `impressions_week`: only LinkedIn shows these, and only to them, so
     read them only in their signed-in browser: `https://www.linkedin.com/dashboard/` has post
     impressions for the past 7 days and profile viewers for the past 90 days (divide by 13, and
     say so in `from`). Signed out: leave both empty; the app tells them why.
   - `best`: their strongest post of the last 90 days by reactions and comments, with its numbers
     compared with their own usual post, and why it worked in one line (the first line, the format,
     the moment it rode). Never compare them with other people.
   - `fixes`: the two changes that would do the most for their goal (`profile.goals`), one plain
     line each: a headline that says who they help, an empty Featured section, a link that goes
     nowhere useful.
6. **A guess at where people go.** If `profile.destination` is empty, write your guess from their
   website and profile as `{"kind": ..., "link": ..., "detail": null, "guess": true}`: `product`
   (a signup, trial or repo), `call` (services with a booking or contact page), `hiring` (a careers
   page they push), `list` (a newsletter or podcast), `work` (open to work). If you can't tell,
   write nothing. The person confirms or changes it.
7. **Ask what you couldn't find.** Write at most 3 `facts` rows with `kind: "question"` and 2–4 tap
   answers in `options` when the answer is a choice, e.g. "Can I name your customers in posts?"
   ["Ask me each time", "Never"]. Skip questions whose answer you already have.
8. **Update, don't duplicate.** Before writing a fact, read the existing `facts` in that section. If one
   already covers the same thing (same label or meaning), update it (value, source, confidence)
   instead of adding a row. Re-running learning must leave one row per fact.
9. **Never overwrite a locked fact** (`locked: true` means the person corrected it). Propose a change as
   a question instead.
10. **Summarise.** Set:
   - `learning_summary`: 3–4 plain sentences on what you learned and what you'll do with it;
   - `voice_confidence`: 0–100, from how many of their own posts you read (a picked voice with no
     posts of theirs starts at 40);
   - `learning_status = "done"`.
11. **Recommend.** Follow the `recommend` skill to create the first recommendation (usually Optimize my
   profile, with the changes you'd make).

If something fails (the site doesn't load, LinkedIn signs you out), keep what you have, set
`learning_status = "done"` anyway, and add a question or a `needs_you` note. Never leave the person
looking at a spinner.

## 3. `[onboarding] voices`: "Find me a good voice"

They don't want to sound like their old posts (or have none). Give them three good voices to pick
from, fast. Background job: aim for 2–3 minutes.

1. Read `profile` (headline, role, company, goals, goal_note) and any `topics` facts. If the headline
   is still empty, wait 30 seconds once (`wait_for`) and re-read; the profile lookup may still be
   running. Then go with what you have.
2. Find strong posts in their field: 2–4 `web_search` queries like `site:linkedin.com/posts <their
   field> <topic>`, and fetch the posts that show high engagement or come up repeatedly. Read 8–15.
3. Study **how** they're written, not who wrote them: hook type, length, structure (story, list,
   contrarian claim, field notes), sentence length, use of numbers, tone, how they end.
4. Write **three distinct voices**, each a pattern you saw work:
   - `name`: a 2–4 word name for the style, never a person ("The plain-spoken builder", "Field notes",
     "The patient teacher");
   - `how`: one sentence on how it writes;
   - `sample`: 40–70 words on one of *their* topics, in that voice. Original text: never copy or
     paraphrase a post you read.
5. Write one `facts` row: `{section: "voice", kind: "question", label: "Pick a voice", options:
   [{name, how, sample}, ...3], source: "posts that do well in your field"}`.
6. Write one `activity` row: `{skill: "learning", action: "note", detail: "Found three voices for you to pick from"}`.

**Never** name, quote or link the creators whose posts you studied, in the facts, the activity or your
reply. When they pick one, the app turns the question into a `voice` fact (`source: "you picked
it"`). Write drafts in that voice until their own edits teach you more.

## 4. Keeping it current

- When they ask "what do you know about me?", answer from `facts`, grouped, in plain words.
- Re-read their profile monthly (the profile skill's check) and their website when they say it changed.
- Edits they make to drafts teach voice. When a draft they edited is approved, compare `first_draft`
  with `body`. If it teaches a rule, add or update a `voice` fact with the date and source `"your edits"`.

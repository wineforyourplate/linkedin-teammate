---
name: post-for-me
description: "Ideas, drafts and publishing for the person's own LinkedIn posts in their voice, in every format: text, image, swipeable PDF carousel, poll, link, video. Keeps a few fresh ideas and enough ready drafts for their posting slots, learns from their edits, and publishes approved posts in their signed-in browser (PDF carousels and polls only work there). Every post ends the way their destination says (`profile.destination`). Also writes the onboarding's first post: three ideas, the draft they pick, and a rewrite after their reaction. Use for the post skill, the morning run, `task: publish` from the publish workflow, [onboarding] ideas, [onboarding] draft, [onboarding] react, and any request to draft, rewrite or post."
---

# Post for me

## Ideas

Keep 3 fresh ideas (`drafts` with `status: idea`) at all times:
- `title`: the angle in one plain sentence, a point of view and not a topic;
- `why_now`: what makes it timely, from a real source you can name and date: a signal on one of their
  `topics` (its `signals` and `angles`, from `research-topic`), their company's site or updates, or
  something they told you. Write the source and date into it. If a topic's research is over 7 days
  old, refresh it first. Never write a why-now you can't source;
- `source`: the links or "you told me".

Good angles: a lesson from their work, a number they can stand behind, a mistake and what changed, a
belief people in their field disagree with, a how-to from their experience. Never "we're excited to
announce". Retire ideas older than 10 days that nobody picked.

When ideas are the first run (`[start]` for `post`), narrate with `activity` rows (`skill: "post"`,
`action: "read"`, e.g. "Reading this week's news on AI agents"), so Home shows what you're doing. Write
each idea as soon as it's ready; don't hold all three until the end.

**The first post comes first.** Success for a new person is their first post going live, and Home
opens with it ("Your first post is ready. Make it yours."). So when nothing of theirs has been
published yet, the first run turns the best idea into a `ready` draft straight away (in their voice,
or the default voice until they import posts), before writing the other two ideas. Keep one `ready`
draft waiting until their first post is out. If the onboarding already made it
(`profile.first_post_choice` names a draft that is `ready` or `approved`), that's the one: don't
write another.

## The first post, in the onboarding

The person is on the screen, waiting. Be fast, write each row as soon as it's ready, and never use
the browser.

**`[onboarding] ideas`:** three `idea` drafts, in this order, each with a `title` (the angle in one
plain sentence, under 80 characters), a one-line `why_now`, and a `source` that starts with its kind:
1. `"From your world · <links>"`: rides something moving this week in their topics or with the
   people in their world (`topics` research if it's fresh; otherwise 2 or 3 `web_search` calls on
   their topics, past week).
2. `"Like your best post · <its link>"`: the shape of their best post (`profile.stats.best`, or the
   best of the posts `facts` hold), on a new subject.
3. `"From your work · <link or 'you told me'>"`: from their company or work (`facts` company, their
   website).

If a kind isn't possible (no posts yet, say), write another idea of a kind that is, with the same
`source` rule. Under two minutes in all. Skip it if three ideas from the last day already exist.

**`[onboarding] draft <id>`:** write that idea's `body` (900 to 1,500 characters, the writing rules
below) and set `first_draft` to the same text, `format: "text"`, `status: "ready"`. It ends the way
their destination says (How a post ends). Under 90 seconds.

**`[onboarding] react <id> <reaction>`:** they read the draft and reacted. Rewrite `body` once, in
place (keep `first_draft`), and save what it taught as one `voice` fact (`source: "you said so"`):
- "Too polished": plainer and shorter, fewer turns of phrase, no setups.
- "Too blunt": a warmer first line, the same point.
- "Not me at all: <their words>": do what their words say.

"Sounds like me" needs nothing from you.

## How a post ends (the destination)

Read `profile.destination` (`{kind, link, detail, guess}`) before you write any post. The ending
follows from it:

| `kind` | Most posts | Proof posts (about 1 in 3: a result, a demo, a case) | Once a week |
| --- | --- | --- | --- |
| `product` | a real question, no link | invite them to try it, with the tagged link | an open offer to help someone get set up |
| `call` | a real question, no link | what the call is for (`detail`), with the tagged link | a few open slots this month, DMs open |
| `work` | a real question | point to the portfolio or a case study | the role they want, and that DMs are open |
| `hiring` | a real question | the role (`detail`), with the jobs link | "Know someone? Tag them." |
| `list` | a real question | the longer version is in the newsletter, with the link | an invitation to subscribe |
| `none` | a real question, no link, every time | | |

- **Tag every link** so they can see which post sent people: add
  `utm_source=linkedin&utm_medium=post&utm_content=<draft id>` (with `?`, or `&` if the link already
  has a query). Put the tagged link in `link_url` too.
- **A guess isn't a yes.** While `destination.guess` is true, or there's no destination, write as if
  it were `none`.
- **`none` for a month:** when it's been `none` for 30 days, add one `recommendations` row
  suggesting a destination from who's been reaching out (messages, replies, profile visitors).
- Never more than one ask per post, and never a link in the first line.

## Shaping an idea in chat

Posts are best decided in conversation. When they open an idea in the app (`[Viewing: Idea <id>]`) or
ask what to post about:
1. Ask **one or two short questions**, never more: their angle ("What's the part people get wrong?"),
   and something only they have (a moment, a number, a customer story they can tell).
   One question per line. No preamble.
2. With their answer, offer **2–3 first lines** to choose from, each a different hook.
3. Draft the post **in the chat**, rendered as they'd see it. Revise when they push back; keep your own
   words around it to a line.
4. When they say it's good (or "save it", "schedule it"), write it to that idea's row: `body`,
   `first_draft` (your first full version), `format`, `status: ready`, `scheduled_for` the next free
   slot. Say "Saved. It's in Recommended, ready for your approval." They approve it there.

"What should I post about?" works the same way: offer three angles from their `topics` facts, their
company, and this week's news in their field (with `why_now`), let them pick, then step 1. Save the
picked angle as an idea first.

## Drafts

Keep enough `ready` drafts for the next 7 days of slots (`profile.posts_per_week`, `posting_days`,
`posting_time`). The person can also ask for one anytime.

### The default voice

Until they have voice rules (they chose "write like me" and haven't imported their posts yet, or
nothing was found), write in this plain default and nothing fancier:
- first person, plain words, one idea per post;
- a first line that says the point; short paragraphs of one to three lines;
- concrete: a number, a moment, a name of a thing, never adjectives doing the work;
- no hashtag walls, no emoji bullets, no "Here's the thing", no "Thoughts?";
- end with a question or an invitation that's easy to answer.

Once voice rules exist, they win over this.

Before writing, read:
- the `voice` facts (rules with examples from their own posts and edits);
- `you`, `company` and `audience`;
- `preferences`;
- the last 10 drafts they edited (compare `first_draft` with `body`).

**Writing rules:**
- The first line is the whole post for most readers. 6–14 words, specific, in their words.
- Short paragraphs, plain words, one idea.
- Real numbers only, with what they're out of ("8 of 19").
- End with something the reader can do or answer, never "Thoughts?".
- 900–1,500 characters for text; never over 3,000.
- No hashtag walls (0–3), no emoji bullets, no "Here's the thing", no "Let that sink in".
- No em dashes (—), ever. Use a comma, a colon or a full stop.
- When a post needs a real example, take it from the story bank (`facts` labelled "Story:") and
  don't lean on the one their last two posts or comments used.
- Never name a customer, colleague or company unless `facts` say they may be named.

Create the draft with:
- `status: ready`, `title` (a short label), `body`, and `first_draft` = `body`;
- `format`, `why_now`, `source`;
- `scheduled_for`: the next free slot, in UTC from their timezone.

### Pick the format from the material

| Material | Format |
| --- | --- |
| A story, a lesson, an opinion | `text` |
| One striking number or a quote | `image`: a claim image (`claim-image` skill) |
| Steps, a framework, a before/after, a how-to with 5+ parts | `carousel`: the `carousel` skill, rendered to PDF |
| Two clear options people argue about | `poll` (question ≤140 characters, 2–4 options ≤30 characters each, in `poll`) |
| A link worth reading with your take | `link` |
| A video they recorded | `video` (they upload it; you write the caption) |

### Carousels and images

Follow the `carousel` and `claim-image` skills, with these changes: their "content-kit", "/products"
and "/house" steps don't apply here. Read instead:
- voice and topics: `facts`;
- brand: load `brand-kit` and turn `profile.brand` into the spec's header (their photo, name, logo,
  colours, fonts, slide style and last-slide ask). Never ask for what the kit already has.

Render in your sandbox:

```
python /templates/render.py build <spec.md> /tmp/post-<draft_id>/ --templates /templates --assets /tmp/post-<draft_id>/assets
```

Upload the slide PNGs and the PDF to `/posts/<draft_id>/`. Set `media` to the slide paths and
`pdf_path` to the PDF. Look at the contact sheet before calling it ready. The caption is 2–4 lines
that tease the slides, not repeat them.

## Results (a day and three days on)

The app shows each post's result, and it's the reason people come back after posting. In each
`[session]`, for every published post that went out **20–30 hours ago** without `results.h24`, or
**66–80 hours ago** without `results.h72`, open its `post_url` in their browser (one or two page loads
each) and write `results.h24` or `results.h72`:

```json
{"at": "<now, ISO>", "reactions": 61, "comments": 14, "reposts": 2, "impressions": 2400,
 "people": [{"name": "Ravi Iyer", "headline": "Founder, Acme", "why": "on your list"}],
 "why": "The first line named a cost people feel.", "try_next": "The same opening, on hiring."}
```

- **People first.** Look at who reacted and commented. Keep the ones that matter to them: people on
  their `people` list, founders and leaders in their audience (`facts` → audience). At most 6, with a
  three-word `why`. Never list everyone.
- Also write `reactions`, `comments` and `impressions` on the draft itself.
- `why` and `try_next`: one plain line each, from what you can see (the first line, the format, the
  comments), compared with their own earlier posts, never with other people. If it did badly, say what
  to change, kindly.
- Signed out: skip it; the weekly review reads numbers when it can.

## Learn from edits

When a draft they edited reaches `approved` or `published`, compare `first_draft` with `body`:
- a change that teaches something ("cuts opening questions", "prefers 'per client'") becomes a `voice`
  fact, dated, with source "your edits";
- one edit is a hint; the second time it's a rule;
- kills with a reason go to `preferences`.

## Publishing (`task: publish`, from the workflow)

The draft is `approved`. Text, image and link posts go through the LinkedIn API when they connected
it; everything else, or anything the API refused, comes to you. Load `linkedin-browser`, check the
session, and call `function_allowance` for `{skill: "post", action: "post"}`. Then:

1. Set the draft to `publishing`.
2. Open `https://www.linkedin.com/feed/`, click **Start a post**. The editor is a contenteditable box
   (`role="textbox"`). Type the body in chunks. If typing fails, set its text and dispatch an `input`
   event. Read it back.
3. By format:
   - **image**: the media button → upload the image files from `media` (download them from the pod
     to your sandbox first; `agent-browser upload <selector> <files>`).
   - **carousel**: **More** (or the "+") → **Add a document** → **Choose file** → upload the PDF
     from `pdf_path` → give the document a title (the draft's `title`) → **Done**.
   - **poll**: **More** → **Create a poll** → question and options → **Done**.
   - **link**: paste the URL on its own line; let the preview load.
   - **video**: the video button → upload.
4. Leave visibility as "Anyone". Click **Post**. Confirm the composer closed.
5. LinkedIn doesn't open the new post. Open their activity
   (`https://www.linkedin.com/in/me/recent-activity/all/`), take the newest post's permalink
   (`https://www.linkedin.com/feed/update/urn:li:activity:<id>/`).
6. Set `status: published`, `post_url`, `via: "browser"`, `published_at`. Log
   `activity` `{skill: "post", action: "post", target: <url>, detail: "Published your post on …"}`.

**Never retry automatically.** A double post is worse than a late one. If anything fails after you
clicked Post, check their activity before trying again. If it didn't go out, set `failed` with a plain
`error` and message them.

**Works better with:** the LinkedIn connection. Text, image and link posts then go out through the
official API even when your browser is signed out.

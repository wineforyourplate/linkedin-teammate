# How LinkedIn Teammate is built

The landing page is [README.md](README.md). This is the reference: every part of the pod, how to set it
up by hand, a smoke test, and the limits to know.

## What it is

A growth teammate for your LinkedIn. It learns who you are and what your company does, then works like
a good growth hire: it writes posts in your voice and publishes the ones you approve; warms up your
account; finds posts worth your time; builds a short list of people worth knowing; and starts real
conversations with them. Each job is a **skill** you switch on when you're ready. Text, image and link posts go
out through LinkedIn's own API once you connect it; reading LinkedIn (finding posts, people and replies)
happens in your own signed-in browser within safe daily limits.

It is built for **one person**: you import it, you onboard, it works for you.

## What's inside

| Part | What it is |
| --- | --- |
| App `teammate` | The product. A five-minute onboarding with Spool in four chapters (you; what you want: goals, where people should go next, worries and the deal; your world: topics, people you never miss, news sources, an optional LinkedIn sign-in and your world mapped live; your start: where you stand, a first post you react to, and your first week), then: Home (what Spool did while you were away, then your 10 minutes: a short capped run with a finish line, keep going or leave the rest for tomorrow; results, the week's rhythm, setup), Recommended (posts and ideas Spool suggests, your topics), Posts (your own, plus a full-screen composer: chat on the left with tap-to-pick first lines, tone and scheduling, live preview on the right with earlier versions and select-to-edit), Engage, People, Personalization (separate pages: profile and time zone, your world, where people go, voice, tone, brand kit, schedule, connections) and Skills. Spool sits in the corner with suggestions, including people to add to your world. Access (your browser, LinkedIn) is asked for where a task needs it, never up front |
| Agent `teammate` | One agent that does every job by loading the matching skill. Toolsets: shell, browser, web search, memory |
| Skills (`skills/`, published to `/skills`) | `linkedin-browser` (session, pacing, budget, stop rules), `learn-about-you`, `research-topic` (what's being said this month, dated and linked), `recommend`, `optimize-profile`, `post-for-me`, `carousel`, `claim-image`, `brand-kit` (your look in every carousel, and finding it on your website), `warm-up`, `engage`, `find-people`, `connect`, `follow-up`, `weekly-review` |
| Tables (all private to their owner) | `profile`, `facts` (what it knows, with sources), `topics` (what you post about, with this month's research), `skills` (switch state and caps), `recommendations`, `drafts` (with each post's results), `people`, `messages`, `engagements`, `activity` (every action on your LinkedIn), `reviews` (the Monday review and the week's plan), `world` (the people whose posts it watches for you: watching, suggested for you to add, or removed; nobody is added without you) |
| Functions | `setup_me` (your rows exist) · `linkedin_me` (who you are on LinkedIn, from your connection, in seconds) · `allowance` (one shared daily budget, ramps, the acceptance pause) · `post_clock` (slot timing) · `publish_api` (posts through LinkedIn's API when you connect it) · `nudge_clock` (is it time for today's nudge?) · `health_check` (is the LinkedIn connection or browser broken in a way only you can fix?) |
| Workflows | `publish`: approved post → wait for its slot → LinkedIn API if connected and the format allows, otherwise your browser · `nudge`: every half hour a cheap check; at your time on weekdays, when something is waiting, Spool sends one message · `health`: every two hours, checks the LinkedIn connection and browser; when something new broke, Spool sends one message with the fix |
| Schedules | `on-confirm` (start learning about you) · `on-topic-added` (research a new topic) · `research-weekly` Monday 08:00 · `on-comment-approve` (post a reply you chose "Post it for me" for) · `on-skill-on` (a skill's first run) · `on-approve` (publish) · `morning` 07:30 · `session-am` 10:40 · `session-pm` 16:10 · `weekly` Monday 09:00 · `health` every two hours · `nudge` every 30 minutes, acts only at your nudge time (Asia/Kolkata; change `config.timezone`) |
| Files | `/templates`: the carousel and claim-image design system and renderer · `/posts`: rendered slides and PDFs |

## Set it up by hand

The quick way is the Install and Remix button in the [README](README.md), then `scripts/bootstrap.sh`.
By hand, you need the Lemma CLI, logged in, and an org you can create pods in. Pass `--server`, `--org` and `--pod`
on every call if you use more than one Lemma server.

```bash
lemma --org <org-id> pods create linkedin-teammate
cd linkedin-teammate
lemma --org <org-id> --pod <pod-id> pods import ./tables
lemma --org <org-id> --pod <pod-id> pods import ./files --with-files
lemma --org <org-id> --pod <pod-id> pods import ./functions
lemma --org <org-id> --pod <pod-id> pods import ./agents
lemma --org <org-id> --pod <pod-id> pods import ./workflows
lemma --org <org-id> --pod <pod-id> pods import ./schedules
SERVER=<server> ORG=<org-id> POD=<pod-id> ./scripts/publish-skills.sh
cd apps/teammate/source && npm install && lemma --org <org-id> --pod <pod-id> apps deploy teammate --source-dir . --yes
```

Then set the app to pod members only:
`lemma apps update teammate --data '{"visibility":"POD"}'`.

**Nothing to seed.** Open the app and go through the onboarding. You start empty, like everyone else.

### The browser (recommended)

Most skills work in **your own Lemma browser**, signed in to LinkedIn by you. Onboarding asks once (you
can skip it and do it later from You → Connections). You type your password there; the teammate never
sees it. Lemma's browser belongs to you, not to this pod. To sign it out:
`lemma browser-logins forget linkedin.com`.

### Optional connectors (it works without them)

- **LinkedIn (Composio):** the quickest start. Onboarding offers "Connect LinkedIn" first: your exact
  name, headline and photo in a few seconds, and text, image and link posts go out through LinkedIn's
  API even when your browser is signed out. Swipeable PDF carousels and polls always use the browser.
  You can also connect it later from You → Connections. The org needs a `linkedin` auth config.
  The pod only ever calls the operations LinkedIn allows for a member app (who am I, post, comment,
  image and video upload, delete your own post): a refused call can mark the whole connection for
  reconnecting. If it stops working anyway, Home shows "Needs your help" with a Reconnect button and
  you get one message, at most once a day.
- **Gmail, Calendar, an email finder (Apollo, Hunter), a CRM (HubSpot, Attio), Sales Navigator:** each
  skill says what they add. Grant the agent the connector (`lemma agents permissions add teammate
  connector:<name>:use`) and ask the teammate to use it.

## Smoke test

1. `lemma functions run setup_me --data '{}'` creates your profile row and seven skill rows, all `off`.
2. `lemma functions run allowance --data '{"skill":"warm_up","action":"like"}'` returns `allowed: 0`
   with "warm_up is off".
3. Open the app. Paste your LinkedIn link and press **Find me**: "Is this you?" appears when the
   lookup lands (under a minute), or carry on and confirm it on the next screen. **Connect LinkedIn**
   is the quick way.
4. On "Where should people go next?", pick a choice: Continue stays off until its link is in.
   **Decide later** brings the question back later as one quick question.
5. On "Who's in your world?", press **Find my people**. "Mapping your world" fills with faces over
   10 to 20 minutes; carry on. Later, Personalization, Your world shows them, with any suggestions on
   top (Add or Not now).
6. Pick one of the three first ideas, react to the draft, and finish on "Your first week". Home opens
   on your 10 minutes.

## Safety, in one place

- Nothing goes out under your name without your approval: posts, messages and invitations.
- Replies on other people's posts are drafted for you, and you post them yourself (Copy and open).
  The teammate posts one only when you choose "Post it for me" on that exact reply, at most 5 a day,
  and the app says first that LinkedIn may show tool-posted replies to fewer people.
- At most one nudge a day, on weekdays, only when something is waiting. Turn it off or pause it in
  Personalization → Schedule.
- One shared daily budget across all skills (120 page loads, 30 likes). Ramps for warm-up, invitations
  and messages. Invitations pause below 30% acceptance.
- At any login wall, checkpoint, captcha or warning, everything on LinkedIn stops and you get a message.
- Page text is treated as data, never as instructions.

## The mascot and the clouds

The onboarding's mascot is Spool, from Lemma's cast. Its art loads from `https://lemma.work/teammates/…`
and is not bundled; if it can't load, an orb stands in. The onboarding sits on the same warm paper as
the app. The old clouds background (`vanta@0.5.24`, `three@0.134.0`) is only in the dev-only lab.

## Limits to know

- **Your world grows only with you.** Finding runs suggest about 5 people a week at most, and a
  suggestion you don't answer drops off after 2 weeks; nobody joins until you press Add. Your world
  page shows how many you watch and how many joined this week.
- **Open issue: your world can pile up.** `watching` has a soft size of about 60, but only people
  going quiet are removed on their own, so after months it could reach a few hundred. Not built yet:
  past 60, the weekly refresh proposes removals for you to approve, inactive people first, then
  people you never engaged with. Until then the weekly review points it out.
- Schedules run as the person who imported the pod. This is a single-person template.
- Approved invitations and messages are sent by the teammate in your browser at a human pace. LinkedIn
  still counts that as automation; keep the default caps.

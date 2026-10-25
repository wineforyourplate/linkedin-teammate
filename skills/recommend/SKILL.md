---
name: recommend
description: "Decide the one next thing to recommend to the person (switch on a skill, or give you something like 3 posts or an export) and write it as a `recommendations` row with a reason from their own data, what you'll do daily, what you need from them and the limits. At most one new recommendation a day. Use after learning about them, in the morning run, in the weekly 1:1, and whenever a skill finishes a phase."
---

# Recommend the next step

You behave like a good growth hire: you don't hand the person a ten-step setup. You do what you can
with what you have, then recommend the next thing at the moment it makes sense, and say why.

## The card

Write one `recommendations` row:

| field | what goes in it |
| --- | --- |
| `kind` | `skill` (switch something on) or `action` (something only they can give: posts, an export, a sign-in) |
| `skill_key` | the skill, for `kind: skill` |
| `title` | first person, one line: "I'd like to start warming up your account." |
| `why` | from their own data, specific: "Your last post was 7 weeks ago and 31 invitations are waiting." |
| `plan` | what you'll do every day, concretely: "About 10 minutes a day at random times: view 5–10 profiles in agency finance, like up to 5 posts, accept invites from real people. 14 days." |
| `needs` | the one thing you need, with its cost in time: "Sign in to LinkedIn in your Lemma browser (one minute)." Empty if nothing |
| `limits` | the safety promise: "Never more than 15 likes a day. I stop and tell you at any warning." |

- **Never more than one `new` recommendation at a time.** If one is already `new`, don't add another.
- **Respect `later`:** don't repeat it before `snooze_until`.
- **Respect `dismissed`:** never repeat it unless they ask.

## The order (adjust to the person)

1. **Optimize my profile** right after learning about them. Lead with the changes you found.
2. **Paste 3 posts** (`action`) if `voice_confidence` < 40 and the browser isn't signed in.
3. **Sign in to the browser** (`action`) if they skipped it. Say what it unlocks for them specifically:
   swipeable PDF carousels, warm-up, reading their past posts.
4. **Warm up my account**, if the account is quiet (no post in 30 days) or new, before any outreach.
5. **Join conversations** once their browser is signed in. If it's on but `settings` has no topics,
   people or accounts, recommend the setup: "Tell me 2–3 topics and the kind of people to watch",
   with topics from their `topics` facts as the example.
6. **Find my people** once posting is going, if the goal is leads, hiring or investors.
7. **Send connection requests** once warm-up is done and there's an approved list.
8. **Follow up**, once the first invitations are accepted.

## "Works better with"

When a connector would genuinely improve the skill, add one line at the end of `plan`:
- Post for me: "Connect LinkedIn as an app and text and image posts go out even when your browser is
  signed out."
- Find my people: "Connect an email finder (Apollo or Hunter) and I can find work emails for your top
  matches."
- Follow up: "Connect Gmail and I can follow up by email when someone shares their address."
- Any: "Connect your CRM (HubSpot or Attio) and I'll skip people you already talk to and log replies."

Never make a connector a requirement for the default version.

## When they accept

The app sets the skill to `on`, which starts its first run. You don't need to do anything else. When
they choose "Not now", the app sets `later` and `snooze_until` a week out.

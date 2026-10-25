---
name: optimize-profile
description: "Review the person's LinkedIn profile against their goal and audience, score it, propose the top 3 fixes as before → after with a reason each, and (after they approve each one) apply it in their signed-in browser, re-read it, and re-score. Monthly re-check. Use for the optimize_profile skill's first run, its monthly check, or when asked to improve their profile, headline, About or Featured."
---

# Optimize my profile

Every post, comment and invite sends people to the profile. It has to say in one glance who they are,
who they help, and what to do next.

Load `linkedin-browser` before opening LinkedIn.

## 1. Read it (never score what you haven't seen)

The first run happens on day one, often before the browser is signed in. Diagnose from what's public;
don't wait for the browser. Narrate as you go with `activity` rows (`skill: "optimize_profile"`,
`action: "read"`, e.g. "Checking your headline against who you want to reach"), so Home shows it live.

1. **The LinkedIn connection**, if it answers (`LINKEDIN_GET_MY_INFO`): exact headline, photo, custom
   URL (`vanityName`).
2. **Public sources:** one `web_search` for their profile (the result snippet carries the headline and
   often the first lines of About), one fetch of the public profile URL (often shows About,
   experience and featured to logged-out visitors; don't retry a login wall), and what
   `learn-about-you` already put in `facts`.
3. **Signed in:** also open their own profile (`https://www.linkedin.com/in/me/`) and read headline,
   About (the full text), current role and description, Featured, banner (describe it), photo
   (present or not, recent or not), skills (top 3), recommendations (count and age), custom URL,
   follow-or-connect primary, and activity (last post date). Load `linkedin-browser` first.

Score only what you could see. For anything you couldn't, add it to `settings.unseen` (e.g.
`["banner", "recommendations"]`) and say "I'll check these once your browser is signed in".

## 2. Score it (100 points)

| Item | Points | What good looks like |
| --- | --- | --- |
| Headline | 12 | What you do · for whom · proof or result. Not just a title. Under 220 characters. No "passionate", no emoji chains, not "Helping X do Y" |
| About: first two lines | 10 | The pitch before "see more", about 270 characters, first person |
| About: body | 10 | Problem → what you do → one real number → the next step. Under ~1,400 characters |
| Featured | 8 | 3 items matched to the goal (leads: lead magnet, case study, booking link; hiring: team, best post, careers; credibility: best content, press) |
| Banner | 6 | One line of positioning + how to reach you, text on the right two thirds. Not the default gradient |
| Photo | 6 | Recent, face about 60% of the frame, plain background |
| Current role | 10 | One scope line + 2–3 outcome bullets with numbers |
| Experience depth | 8 | Older roles compressed to one line each |
| Skills | 6 | Top 3 = what they want to be known for |
| Recommendations | 8 | 3+ in the last 2 years, naming outcomes |
| Activity | 10 | Posted or commented in the last 7 days |
| Contact | 6 | Custom URL, a working email or booking link |

Most first profiles land in the 30s–40s. Say the real number.

## 3. The top 3 fixes

- Rank by points lost and pick 3. Don't hand them 12.
- For each fix write a `recommendations`-style card into the skill row's `settings.changes`:
  `[{part, now, next, why, points, applied: false}]`.
- Give 3 headline options when the headline is one of the fixes.
- Write in their voice (`facts` voice), with their real proof only (`facts` company and you). Never
  invent a number or a client.
- Save `settings.score` (the number, out of the points you could see, scaled to 100),
  `settings.checked_at`, and `settings.checks`: `[{item, points, max, note}]` for every row of the
  table you scored. Home shows the score the moment you write it.
- Set `status_text`, e.g. "Score 41/100 · 3 changes to review".

## 4. Apply (after they approve each change)

The app marks a change approved (`settings.changes[i].approved = true`). On the next run, or when
they ask:
1. Me → Settings & Privacy → Visibility → turn **off** "Share profile updates with your network"
   (remember its old value).
2. Edit one section at a time via its pencil (intro card for headline, About, Featured, the role).
   Type like a hand. Save.
3. Re-read the saved section and confirm it matches. Mark `applied: true`, and log
   `activity` `{action: "profile_edit", detail: "Updated your headline"}`.
4. Restore the sharing setting.
5. Stop if a save fails or a verification prompt appears.

Some things only they can do. List them plainly:
- photo and banner files: describe the banner; with an image tool connected, offer to make one at
  1584×396;
- asking for recommendations: draft the request messages for them to send;
- the custom URL: only 5 changes per 6 months, so suggest it and let them do it.

## 5. Re-score and re-check

After applying, re-score honestly ("41 → 72; the rest needs a banner and 2 recommendations"). Set
`status_text` to "Optimized · 72/100" when no approved change is left. Re-check monthly or when
their goal changes; propose only what changed.

**Works better with:** an image tool (banner and Featured thumbnails), your LinkedIn data export (full
profile without the browser).

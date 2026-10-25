---
name: find-people
description: "Build a short, ranked list of people worth knowing for the person's goal (customers, hires, investors), each with the signal that surfaced them, evidence, a fit score and a one-line reason, deduped against people already known. Read-only, in their signed-in browser. Writes `people` rows (stage: found) for them to approve. Use for the find_people skill in a session, its first run, or when asked to find leads, prospects, candidates or investors."
---

# Find my people

A list of 20 people who have a real reason to hear from them beats 500 names from a search.

Load `linkedin-browser` first. **Read only:** never click Connect, Follow, Message or any reaction in
this skill. Every profile you open counts toward `function_allowance`
`{skill: "find_people", action: "view_profile"}` and the shared page budget.

## 1. Who (the ICP)

Use `facts` (`audience`, `company`) and `profile.goal`. You need:
- roles and seniority, and roles to exclude;
- industries and company types;
- company size and stage;
- locations in and out;
- hard exclusions: competitors, students, recruiters, people they already know.

If the audience facts are too vague to search, **don't guess**. Add one `facts` question ("Who's your
ideal customer: role, company size, where?") and stop.

## 2. Where to look (strongest first)

| Source | Where | Signal |
| --- | --- | --- |
| People who commented on **their** posts | their post → comments (and the reactions list) | strong |
| Commenters on posts about the problem they solve | Search → Posts, past week, keywords from their topics → open → comments | strong when the comment has substance |
| Engagers on competitors' or adjacent companies' posts | the company page → Posts → comments | medium to strong |
| Profile viewers | "Who's viewed your profile" (free accounts show 3) | strong but small |
| Trigger events | a role they hire for, funding news, a new job | medium |
| People search with filters | Search → People → All filters (location, current company, industry, title keywords) | weak: attributes only |

**Free accounts have a monthly people-search limit.** People search, "People also viewed" and a
company's People tab count against it; name searches and their own connections don't. Prefer the
engagement sources. Tell them if the limit is hit.

## 3. Start small, then continue

On the first run, process 3 sources and write what you found. The app shows it and they approve the
list, and later runs continue from there. Stop at `caps.list_size` (50) open "found" people. Never
paginate endlessly.

## 4. For each candidate

Keep a person only if their headline or activity matches the ICP. Open the profile **once** and record:
- `name`, `headline`, `company`, `profile_url` (the plain `/in/<slug>/` form);
- `source`;
- `reason`: the signal + one line of fit, factual, no flattery ("Commented on your margins post asking
  how close works for retainers; ops lead at a 30-person agency in Pune");
- `score` (0–10):

| Part | Points |
| --- | --- |
| Fit: headline vs ICP | 0–3 |
| Intent: asked about the problem = 3; described the problem = 2; specific praise = 1 | 0–3 |
| Recurrence: engaged with 2+ of their posts | 0–2 |
| Reach: decision maker or creator | 0–2 |

  Write people below 4 only if the list is short, and mark peers and competitors in `reason` as
  "peer, not a lead".
- `stage: found`;
- `invite_note`: a draft note for later (≤200 characters): one specific reference + who they are + no
  ask. If there's no genuine reference, leave it empty.

**Dedupe** against every `people` row (by URL and by name + company), and against anyone contacted in
the last 84 days. Never infer age, ethnicity or personality from photos.

Log every profile view to `activity`. Set the skill's `status_text`: "14 people found · 6 waiting for
your approval". Write which sources produced nothing in `last_result` so the next run skips them.

**Works better with:**
- Sales Navigator: bigger, sharper searches;
- an email finder (Apollo or Hunter): work emails for your top matches;
- your CRM (HubSpot or Attio): skip people you already talk to.

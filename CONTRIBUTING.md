# Contributing to LinkedIn Teammate

LinkedIn Teammate is a complete Lemma pod, so a change should keep the whole loop working: onboarding,
your ten minutes, publishing, engage runs, the health check and the Monday review.

## Before opening a pull request

1. Run `npm ci` and `npm run build` in `apps/teammate/source`.
2. Validate the bundle with `lemma --pod <pod-id> pods import . --dry-run`.
3. Check every agent and function has only the tables, folders and connectors it needs
   (`permissions.grants` in its JSON).
4. Keep tokens, member ids, connector accounts, `.env.local` and anyone's real data out of the commit.
5. Describe the user-visible behaviour that changed, with a screenshot for any screen you touched.

## Product rules

- **Nothing goes out under the person's name without their approval.** No setting may bypass it.
- **Through the LinkedIn connector, call only what LinkedIn allows a member app** (see the list in
  `agents/teammate/instruction.md`). Never add a test call to anything else: one refused call can mark
  the person's whole connection for reconnecting.
- **Never write an em dash** in anything the person reads or that goes out under their name. It reads
  as machine-written. The agent instruction says so too.
- **App copy is for strangers.** No internal reasoning, no jargon; every line should make sense to
  someone who just installed the pod.

## Running the app locally

```bash
cd apps/teammate/source
cp .env.example .env.local   # then set VITE_LEMMA_POD_ID, and the API and auth URLs for your Lemma
npm ci
npm run dev
```

The dev build has a preview that renders every screen on invented data, with writes kept in memory:

| URL | What you see |
| --- | --- |
| `/?preview=app&demo=1#/home` | The app after a good week (also `#/engage`, `#/posts`, `#/personal/world`) |
| `/?preview=app&demo=1&link=reauth` | Home with "Needs your help": the LinkedIn connection broken |
| `/?preview=composer&demo=1` | The composer |
| `/?preview=goals` | An onboarding screen (`profile`, `goals`, `dest`, `deal`, `world`, `signin`, `reveal`, `stand`, `first`, `week`) |
| `&hello=0` | Keeps Spool's hello bubble closed, for screenshots |

The screenshots in `docs/` come from these URLs.

## Keeping the format craft in sync (maintainers)

The carousel and claim-image skills and `files/templates` come from Lemma's content pod. To pull its
latest, `CF=<path to that pod's bundle> ./scripts/sync-formats.sh`, then re-run
`scripts/bootstrap.sh`. The base slide look in `files/templates/brand/tokens.css` is Lemma's; carousels
take the person's brand kit through the spec's header, as the `brand-kit` skill says. This pod's
`render.py` adds that brand kit support, and the sync script keeps it.

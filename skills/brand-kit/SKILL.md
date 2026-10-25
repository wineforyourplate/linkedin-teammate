---
name: brand-kit
description: "The person's brand kit (`profile.brand`): how it becomes the header of every carousel spec (their headshot, name and byline, logo or wordmark, colours, fonts, slide style, last-slide ask), and `[brand] import <url>`: read their website for logo, colours and fonts and leave what you find in `profile.brand.suggested` for them to keep or skip. Use before writing or rendering any carousel or claim image, for [brand] import, and when they ask to change how their slides look."
---

# Brand kit

They set their look once, in the app under Personalization → Brand kit, and every carousel uses it.
The app shows a live preview built from the same rules as below, so what they saw is what they get.
Never ask them for anything the kit already has.

## What's in it, and the defaults

`profile.brand` is JSON. Anything missing takes the default in the right-hand column, which is also what
the app shows.

| Field | Meaning | Default |
| --- | --- | --- |
| `posting_as` | `me` or `company` | `me` |
| `name` | The name on every slide | `linkedin_name` (me) or `company_name` (company) |
| `byline` | Under the name, up to 36 characters | The first part of `headline` (me) or the website's domain (company) |
| `headshot` | Show their photo | `true` for me, `false` for a company |
| `photo` | A headshot they uploaded (`path`) | `profile.photo_url` |
| `logo`, `wordmark` | Square mark, and the name as a wide logo. `{path, id, url, tone}` | none |
| `logo_dark`, `wordmark_dark` | The versions for dark slides | none |
| `logo_on` | `cover_cta`, `every` or `never`: where the logo sits when the footer is the person | `cover_cta` |
| `colors.primary` | The brand colour: highlights, numbers, the last slide's box | `#5266eb` |
| `colors.secondary` | Used for highlights when the brand colour is faint on the background | none |
| `colors.light`, `colors.dark` | Slide backgrounds | Derived from the brand colour; leave them out of the spec |
| `fonts.heading`, `fonts.body` | Google Fonts families | `Inter Tight`, `Inter` |
| `style` | `dark`, `light` or `brand` | `dark` |
| `slide_numbers` | The "3/8" counter | `true` |
| `swipe` | The cover's swipe cue | `Swipe →` |
| `cta.ask` | `follow`, `comment`, `repost`, `dm` or `link`, plus `line`, `keyword`, `link` | `follow` |

Text colours are never part of the kit. The renderer picks near-black or white for contrast.

## Into a carousel spec

Before writing the spec's header, read `profile` and turn the kit into these lines:

| Kit | Spec line |
| --- | --- |
| `style` | `theme: dark`, `theme: paper` (light) or `theme: accent` (brand) |
| `colors.primary` | `accent: <hex>` |
| `colors.light` (only if set) | `bg: <hex>` |
| `colors.dark` (only if set) | `dark_bg: <hex>` |
| `fonts.heading`, `fonts.body` | `font_display: <family>`, `font_body: <family>` |
| `posting_as: me` | `name:`, `byline:`, and `headshot: assets/me.jpg` when `headshot` is on |
| `posting_as: company` | `brand: <name>` (the footer label) |
| Logo and wordmark | `logo: assets/<file>` and `wordmark: assets/<file>`. For a `dark` or `accent` deck use `logo_dark` / `wordmark_dark` when they exist. For `paper`, use `logo` / `wordmark`; if only a dark-slide version exists, leave it out |
| `logo_on` | `logo_on: <value>` |
| `slide_numbers: false` | `slide_numbers: off` |
| `swipe` | `swipe: <text>` |

One key per line. Bring the images into the render folder first:

```
mkdir -p /tmp/post-<draft_id>/assets
lemma files download <logo.path> /tmp/post-<draft_id>/assets/<file name>
curl -sL "<profile.photo_url>" -o /tmp/post-<draft_id>/assets/me.jpg   # or download photo.path
```

An image with only a `url` (found on their site and not saved) can go in the spec as the https URL.
Then render with `--assets /tmp/post-<draft_id>/assets`.

**The last slide** uses `cta` unless the post needs a different ask:
- `follow`: "Follow <first name> for more" / "and tap the bell so you don't miss the next one";
- `comment`: "What would you add?" / "Tell me in the comments";
- `repost`: "Repost to help one person" / "Someone in your network needs this";
- `dm`: "DM me "<KEYWORD>"" / "I'll send you the full version";
- `link`: "Get the full guide" / the `link` text.

`cta.line`, when set, replaces the first line.

**A one-off change** ("make this one light", "use my company logo here") goes in that spec only. If
they say to keep it ("always", "make this my default"), update `profile.brand` too and tell them in a
line.

## `[brand] import <url>`: find their brand on their website

They asked from the Brand kit page, and the page is waiting. Narrate each step as an `activity` row
(`skill: "brand"`, `action: "read"`, a short `detail` such as "Found your logo in the header"). The
page shows the latest one.

1. Open the site in your browser, or fetch it if the browser isn't free. Look at the home page header
   and footer, and the `<head>`.
2. **Logo.** Look for, in this order: the header `<svg>` or `<img>` whose class, alt or file name says
   logo; `apple-touch-icon` (a square mark); `og:image` only if it is plainly the logo. A favicon alone
   is never the logo. A wide one (wider than 2:1) is the **wordmark**; a square one is the **mark**.
   Download each one you keep and upload it to `/me/brand/<mark|wordmark>-site.<ext>` (`lemma files
   upload <file> /me/brand/<name> --no-search`). Set `tone: "light"` if it's mostly white or very light
   (it's for dark slides), otherwise `"dark"`.
3. **Colours.** Take the brand colour from CSS variables (`--primary`, `--brand`, `--accent`), the main
   button's background, or the link colour, and a second colour if the site clearly uses one. Ignore
   cookie banners, chat widgets and third-party embeds. Skip near-white, near-black and greys.
4. **Fonts.** Use the Google Fonts `<link>` families, or the font of the `h1` (heading) and body. Only
   suggest a family Google Fonts has with a bold weight: check
   `https://fonts.googleapis.com/css2?family=<Name+With+Plus>:wght@700` answers 200. If their font
   isn't there, suggest the closest one that is and say so in `notes`.
5. **Byline.** For a company, the domain. For a person, leave it unless the site has a short tagline
   about them.
6. **Write only `profile.brand.suggested`**: `{from: <url>, at: <now, ISO>, logo, wordmark, primary,
   secondary, heading, body, byline, notes}`. Leave out what you didn't find, and put what you couldn't
   find in `notes` in one sentence ("No wordmark on the site, only the mark."). Read `profile.brand`
   first and write it back with only `suggested` changed. Never change the fields they set: they
   choose what to keep. If `profile.website` is empty, set it.
7. Reply in one line, for example: "I found your logo, two colours and your fonts on northwind.com.
   They're in Brand kit for you to keep or skip."

If the site won't load or blocks you, write an `activity` row with `result: "warning"` and a
`suggested` holding only `from`, `at` and `notes` ("I couldn't open northwind.com. Upload your logo
instead."), so the page stops waiting.

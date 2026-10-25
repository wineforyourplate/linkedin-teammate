---
name: carousel
description: "Write a carousel (a swipe post for LinkedIn, Instagram or X) as a slide spec that the template renderer turns into PNGs and a PDF: choose the style that fits, fill each slide's layout slots within their word budgets, point image slots at real screens. Use for any piece with skill carousel, or when someone asks for a carousel, a swipe post, a product tour, a mythbuster or a playbook in slides. Do not use to change how slides look (templates live in /templates) or to save a new carousel style (the styles skill)."
---

# Carousel

A carousel is a short story told one swipe at a time. You never write slide HTML. You write a **spec**: which layout each slide uses and the words for each slot. The design is fixed in `/templates/carousel/layouts/` and `/templates/brand/tokens.css`, so every carousel looks like the brand without anyone tweaking it.

## Before writing

1. Follow "Before writing any piece" in the `content-kit` skill: voice, visuals, lessons, the product.
2. **Choose the style.** The house keeps its carousel styles in `/house/carousel/<style>.md`. Each says when to use it, when not to, and which slide sequence it follows. Use the one the piece or kit item names; otherwise compare the piece's material (a real story? a surprising number? screens to walk through? a belief to correct? a playbook to give away?) with each style's `use_when` and `not_for`, and pick the best fit. Record it in `piece.style` with a one-line `style_reason`.
3. Read `/templates/carousel/layouts.json` for the layouts, their slots and word budgets, and the style's sequence in `/templates/carousel/sequences/<sequence>.json`. Keep the order unless a slide has nothing true to say.

No style fits, or no `/house`? Use the default shape below and say which style you'd add.

## The default shape

1. **Cover.** One plain sentence about the reader's situation or what happened. 6–10 words. It has to read at thumbnail size.
2. **The moment.** The specific thing that happened: who, what, when. A real message as a screenshot works well.
3. **The reveal, by slide 3 or 4.** Show the product doing the thing. Don't hold the payoff back.
4. **The middle (2–4 slides).** One move per slide. Alternate a product slide and a words slide: show, say, show.
5. **The honest slide.** What a person still decides, or what it doesn't do. One line.
6. **The last slide.** One action.

## The spec

```
# Carousel: <title>
sequence: <the style's sequence>
theme: dark
brand: <product teammate_title>

## 1 · cover
kicker: Software Factory
headline: A Slack complaint in. A merged **fix** out.

## 2 · steps
headline: Put it together in three steps
steps:
- Clone it into your workspace
- Connect GitHub and Slack
- Tell it which channel to watch
```

- One block per slide: `## <n> · <layout>`, then `slot: value` lines. List slots take `- item` lines under `slot:`.
- `**word**` makes a word bold; `==words==` puts the highlighter on them. One highlight per slide at most.
- Image slots take a pod path, from `/products/<slug>/screens/` or `/assets/`. Use a real screen that proves the slide's point, and check it's clean: no error states, no real person's name or face without their OK. If none fits, use a layout without an image.
- A slide may set `theme: paper` or `theme: accent` to break the rhythm once.
- Nothing else goes in the file: no notes, no `<!-- -->` comments, no bookkeeping. Cautions for the operator (a real name on a screen, an error state, a number not yet signed off) go in your reply and in `product.gaps`, never in the spec.

## Rules that make carousels work

- **Slide 1 is the whole post for most readers.** An outcome someone could repeat as news, starting where the reader starts. Under 12 words.
- **One idea per slide.** If a slide needs "and", it's two slides, or one too many.
- **Numbers carry their denominator** ("8 of 19") and their source, on the stat slide.
- **Keep one honest slide.** Readers trust it more than any feature slide.
- **One action at the end.**
- **Count words.** The budgets in `layouts.json` are hard limits; the renderer refuses slides over them. Check with `python /templates/render.py check <spec>` when you can. Shorter always wins.

## Hand-off

Save the spec as the piece's draft (`kit/` for a kit piece, `content/` otherwise, under `/products/<slug>/`). On approval the designer agent renders it with `/templates/render.py build`. If it sends the piece back with an `error`, it names the slide and the slot to fix.

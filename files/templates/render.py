#!/usr/bin/env python3
"""Content Factory carousel renderer.

A carousel draft is a readable markdown spec: a few header lines, then one block per
slide naming its layout and filling its slots. This script turns that spec into a deck
of slides that always look the same, because the design lives in the layout templates
and tokens.css, never in the draft.

    python render.py check   SPEC.md                # validate slots and word budgets only
    python render.py compose SPEC.md OUT/           # write OUT/deck.html (no browser)
    python render.py build   SPEC.md OUT/           # compose + render PNGs, PDF, contact sheet

Options:
    --templates DIR   the /templates folder (default: this script's folder)
    --assets DIR      where image slots' files can be found (searched by path, then by name)

Spec format:

    # Carousel: <title>
    sequence: the-loop          (optional, informational)
    theme: dark                 (dark | paper | accent; a slide can override with `theme:`)
    brand: Software Factory     (footer label; default "Lemma")
    accent: #8ee3a9             (optional accent override)
    Brand kit (all optional, from the person's kit; one key per line):
    font_display: Bricolage Grotesque    (heading font, a Google Fonts family)
    font_body: Inter                     (body font)
    bg: #f6f4ff                          (paper theme background)
    ink: #1b1530                         (paper theme text)
    dark_bg: #171721                     (dark theme background)
    dark_ink: #f6f4ff                    (dark theme text)
    headshot: assets/me.jpg              (the person in the footer; large on the CTA slide)
    name: Sam Rivera                     (next to the headshot)
    byline: Co-founder, Lemma            (under the name)
    logo: assets/logo.png                (a square mark)
    wordmark: assets/wordmark.png        (the name as a logo, wide)
    logo_on: cover_cta                   (cover_cta | every | never: where the logo sits top-right
                                          when the footer is the person; otherwise it's in the footer)
    slide_numbers: on                    (page counter on or off)
    swipe: Swipe →                       (the cover's swipe cue)
    Headshot, logo and wordmark can also be https URLs.

    ## 1 · cover
    kicker: Software Factory
    headline: Nobody filed a ticket. It still got **fixed**.

    ## 2 · steps
    headline: Put it together in three steps
    steps:
    - Clone the pod
    - Connect GitHub and Slack
    - Say what to watch

Prints a JSON manifest on stdout: {"slides", "deck", "pdf", "sheet", "problems"}.
Exit code 2 when there are problems (so a caller can loop: fix the spec, rebuild).
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

W, H = 1080, 1350
MIN_FONT_PX = 28
HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------- spec parsing

SLIDE_RE = re.compile(r"^##\s*(\d+)\s*[·\-.:]\s*([a-z0-9\-]+)\s*$", re.I)
KV_RE = re.compile(r"^([a-z_][a-z0-9_]*)\s*:\s*(.*)$", re.I)


def parse_spec(text: str) -> dict:
    meta: dict = {}
    slides: list[dict] = []
    cur: dict | None = None
    list_key: str | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.strip().startswith("<!--"):
            continue
        if line.startswith("# ") and cur is None:
            meta["title"] = line[2:].split(":", 1)[-1].strip()
            continue
        m = SLIDE_RE.match(line.strip())
        if m:
            cur = {"n": int(m.group(1)), "layout": m.group(2).lower(), "slots": {}}
            slides.append(cur)
            list_key = None
            continue
        stripped = line.strip()
        if stripped.startswith("- ") and list_key and cur is not None:
            cur["slots"].setdefault(list_key, []).append(stripped[2:].strip())
            continue
        kv = KV_RE.match(stripped)
        if kv:
            key, val = kv.group(1).lower(), kv.group(2).strip()
            target = cur["slots"] if cur is not None else meta
            if val == "":
                list_key = key
                target[key] = []
            else:
                list_key = None
                target[key] = val
    return {"meta": meta, "slides": slides}


# ---------------------------------------------------------------- validation

def words(s) -> int:
    if isinstance(s, list):
        return sum(words(x) for x in s)
    plain = re.sub(r"(\*\*|==)", "", str(s))
    return len([w for w in re.split(r"\s+", plain.strip()) if w])


def validate(spec: dict, layouts: dict) -> list[str]:
    problems: list[str] = []
    defs = layouts["layouts"]
    cap = layouts.get("slide_max_words", 30)
    if not spec["slides"]:
        problems.append("no slides found: each slide starts with '## <n> · <layout>'")
    for s in spec["slides"]:
        n, lay = s["n"], s["layout"]
        if lay not in defs:
            problems.append(f"slide {n}: unknown layout '{lay}' (use one of: {', '.join(defs)})")
            continue
        slots = defs[lay]["slots"]
        for name, rule in slots.items():
            val = s["slots"].get(name)
            if rule.get("required") and (val is None or val == "" or val == []):
                problems.append(f"slide {n} ({lay}): '{name}' is required")
            if val in (None, "", []):
                continue
            kind = rule.get("kind")
            if kind == "list":
                items = val if isinstance(val, list) else [val]
                if len(items) > rule.get("max_items", 99):
                    problems.append(f"slide {n} ({lay}): '{name}' has {len(items)} items (max {rule['max_items']})")
                for it in items:
                    if words(it) > rule.get("max_words", 99):
                        problems.append(f"slide {n} ({lay}): '{name}' item \"{it[:40]}\" is {words(it)} words (max {rule['max_words']})")
            elif kind in ("text", "number"):
                if words(val) > rule.get("max_words", 99):
                    problems.append(f"slide {n} ({lay}): '{name}' is {words(val)} words (max {rule['max_words']})")
            elif kind == "choice" and val not in rule.get("options", []):
                problems.append(f"slide {n} ({lay}): '{name}' must be one of {rule['options']}")
        for name in s["slots"]:
            if name not in slots and name not in ("theme",):
                problems.append(f"slide {n} ({lay}): unknown slot '{name}' (slots: {', '.join(slots)})")
        total = sum(words(v) for k, v in s["slots"].items() if slots.get(k, {}).get("kind") in ("text", "list", "number"))
        if total > cap:
            problems.append(f"slide {n} ({lay}): {total} words on the slide (max {cap})")
    return problems


# ---------------------------------------------------------------- composing

def fmt(text: str) -> str:
    out = html.escape(str(text))
    out = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"==(.+?)==", r'<span class="mark">\1</span>', out)
    return out


SECTION_RE = re.compile(r"\{\{([#^])([a-z0-9_]+)\}\}(.*?)\{\{/\2\}\}", re.S)
VAR_RE = re.compile(r"\{\{([a-z0-9_.]+)\}\}")


def render_tpl(tpl: str, ctx: dict) -> str:
    def section(m):
        kind, key, inner = m.group(1), m.group(2), m.group(3)
        val = ctx.get(key)
        truthy = bool(val) and val != []
        if kind == "^":
            return render_tpl(inner, ctx) if not truthy else ""
        if not truthy:
            return ""
        if isinstance(val, list):
            return "".join(render_tpl(inner, {**ctx, ".": item}) for item in val)
        return render_tpl(inner, ctx)

    prev = None
    while prev != tpl:
        prev = tpl
        tpl = SECTION_RE.sub(section, tpl)

    def var(m):
        key = m.group(1)
        val = ctx.get(key, "")
        if key in ("image",):
            return html.escape(str(val), quote=True)
        if key in ("theme", "frame", "page", "total", "page2", "brand"):
            return html.escape(str(val))
        return fmt(val)

    return VAR_RE.sub(var, tpl)


def find_asset(path: str, assets_dir: Path | None) -> Path | None:
    p = Path(path)
    if p.is_file():
        return p
    if assets_dir:
        cand = assets_dir / path.lstrip("/")
        if cand.is_file():
            return cand
        for f in assets_dir.rglob(Path(path).name):
            if f.is_file():
                return f
    return None


def brand_kit_css(meta: dict) -> str:
    """Fonts and paper colours from the person's brand kit, as CSS overrides."""
    css: list[str] = []
    fonts = [f for f in (meta.get("font_display"), meta.get("font_body")) if f]
    link = ""
    if fonts:
        fams = "&".join("family=" + f.strip().replace(" ", "+") + ":wght@400;500;600;700;800" for f in dict.fromkeys(fonts))
        link = f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{html.escape(fams)}&display=swap">'
    root = []
    if meta.get("font_display"):
        root.append(f'--display:"{html.escape(meta["font_display"])}", "Inter", system-ui, sans-serif;')
    if meta.get("font_body"):
        root.append(f'--body:"{html.escape(meta["font_body"])}", "Inter", system-ui, sans-serif;')
    accent = meta.get("accent")
    if accent:
        # paper slides use their own accent unless told; a dark accent needs light ink on bold slides
        root.append(f"--accent-paper:{html.escape(accent)};")
        css.append(f".slide.accent{{--ink:{_ink_on(accent)};--dim:color-mix(in srgb,{_ink_on(accent)} 78%,{html.escape(accent)});--mark-ink:{html.escape(accent)}}}")
        css.append(f".slide.accent .foot .brand i{{background:{_ink_on(accent)}}}")
    if root:
        css.insert(0, ":root{" + "".join(root) + "}")
    dim = "--dim:color-mix(in srgb,var(--ink) 72%,var(--bg));--line:color-mix(in srgb,var(--ink) 14%,var(--bg));"
    dark = []
    if meta.get("dark_bg"):
        dark.append(f"--bg:{html.escape(meta['dark_bg'])};--panel:color-mix(in srgb,var(--bg) 88%,white);")
    if meta.get("dark_ink"):
        dark.append(f"--ink:{html.escape(meta['dark_ink'])};")
    if dark:
        css.append(".slide:not(.paper):not(.accent){" + "".join(dark) + dim + "}")
    paper = []
    if meta.get("bg"):
        paper.append(f"--bg:{html.escape(meta['bg'])};")
    if meta.get("ink"):
        paper.append(f"--ink:{html.escape(meta['ink'])};--mark-ink:{html.escape(meta['ink'])};")
    if paper:
        css.append(".slide.paper{" + "".join(paper) + dim + "}")
    css.append(".foot .brand img.brand-logo{height:44px;width:auto;max-width:180px;object-fit:contain}"
               ".foot .brand img.brand-wordmark{height:46px;width:auto;max-width:420px;object-fit:contain}"
               ".foot .brand.person{gap:20px}.foot .brand img.brand-face{width:84px;height:84px;border-radius:50%;object-fit:cover}"
               ".foot .brand .who{display:flex;flex-direction:column;gap:2px;line-height:1.15}.foot .brand .who b{font-size:30px}"
               ".foot .brand .who small{font-size:24px;font-weight:500;color:var(--dim)}"
               ".slide img.brand-top{position:absolute;top:var(--pad-y);right:var(--pad-x);height:64px;width:auto;max-width:200px;object-fit:contain}"
               ".slide img.brand-top.wide{height:52px;max-width:380px}"
               ".slide img.cta-face{width:180px;height:180px;border-radius:50%;object-fit:cover;margin-bottom:48px;box-shadow:0 0 0 6px var(--accent)}")
    return link + "<style>" + "".join(css) + "</style>"


def _ink_on(hex_colour: str) -> str:
    """Near-black or white, whichever reads better on this colour."""
    h = hex_colour.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return "#0b0d0c"
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    return "#0b0d0c" if lum > 0.36 else "#ffffff"


def _brand_src(ref: str, out: Path, assets_dir: Path | None, problems: list[str]) -> str | None:
    if ref.startswith("http://") or ref.startswith("https://"):
        return ref
    src = find_asset(ref, assets_dir)
    if src is None:
        problems.append(f"brand kit image not found: {ref}")
        return None
    dest = out / "assets" / src.name
    if src.resolve() != dest.resolve():
        shutil.copy(src, dest)
    return f"assets/{src.name}"


def brand_kit_marks(slide_html: str, meta: dict, out: Path, assets_dir: Path | None, problems: list[str]) -> str:
    """The person and their marks on each slide, from the brand kit.

    With a headshot or name, the footer is the person (face, name, byline) and the logo
    sits top-right on the slides `logo_on` names (cover_cta, every, never). Without one,
    the footer is the wordmark, or the logo mark before the label. The CTA slide gets a
    large headshot above the ask."""
    first = re.match(r'<section class="slide [^"]*\bl-([\w-]+)', slide_html)
    layout = first.group(1) if first else ""
    edge = layout in ("cover", "cta", "close")
    face = _brand_src(str(meta["headshot"]), out, assets_dir, problems) if meta.get("headshot") else None
    name = meta.get("name")
    logo = _brand_src(str(meta["logo"]), out, assets_dir, problems) if meta.get("logo") else None
    wordmark = _brand_src(str(meta["wordmark"]), out, assets_dir, problems) if meta.get("wordmark") else None
    foot = re.compile(r'<span class="brand"><i></i>[^<]*</span>')
    if face or name:
        who = (f'<img class="brand-face" src="{html.escape(face)}" alt="">' if face else "") + (
            f'<span class="who"><b>{html.escape(str(name))}</b>'
            + (f'<small>{html.escape(str(meta["byline"]))}</small>' if meta.get("byline") else "")
            + "</span>" if name else "")
        slide_html = foot.sub(lambda _m: f'<span class="brand person">{who}</span>', slide_html)
        top = wordmark or logo
        on = str(meta.get("logo_on", "cover_cta"))
        if top and (on == "every" or (on == "cover_cta" and edge)):
            cls = "brand-top wide" if wordmark else "brand-top"
            slide_html = re.sub(r'(<section class="slide [^"]*">)', lambda m: m.group(1) + f'<img class="{cls}" src="{html.escape(top)}" alt="">', slide_html, count=1)
        if face and layout in ("cta", "close"):
            slide_html = slide_html.replace('<div class="spacer"></div>', f'<div class="spacer"></div><img class="cta-face" src="{html.escape(face)}" alt="">', 1)
    elif wordmark:
        slide_html = foot.sub(lambda _m: f'<span class="brand"><img class="brand-wordmark" src="{html.escape(wordmark)}" alt=""></span>', slide_html)
    elif logo:
        slide_html = slide_html.replace('<span class="brand"><i></i>', f'<span class="brand"><img class="brand-logo" src="{html.escape(logo)}" alt="">')
    if meta.get("slide_numbers") in (False, "off", "false", "no"):
        slide_html = re.sub(r"<span>\d+/\d+</span>", "<span></span>", slide_html)
    if meta.get("swipe"):
        slide_html = slide_html.replace("<span>Swipe →</span>", f"<span>{html.escape(str(meta['swipe']))}</span>")
    return slide_html


def compose(spec: dict, templates: Path, out: Path, assets_dir: Path | None) -> tuple[Path, list[str]]:
    problems: list[str] = []
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy(templates / "brand" / "tokens.css", out / "tokens.css")
    (out / "assets").mkdir(exist_ok=True)
    meta = spec["meta"]
    theme = meta.get("theme", "dark")
    brand = meta.get("brand", "Lemma")
    total = len(spec["slides"])
    parts = []
    for i, s in enumerate(spec["slides"], start=1):
        tpl_path = templates / "carousel" / "layouts" / f"{s['layout']}.html"
        if not tpl_path.is_file():
            problems.append(f"slide {s['n']}: no template for layout '{s['layout']}'")
            continue
        ctx = {k: v for k, v in s["slots"].items()}
        ctx.setdefault("frame", "desktop")
        ctx["theme"] = s["slots"].get("theme", theme)
        ctx.update(brand=brand, page=i, total=total, page2=f"{i:02d}")
        if ctx.get("image"):
            src = find_asset(str(ctx["image"]), assets_dir)
            if src is None:
                problems.append(f"slide {s['n']}: image not found: {ctx['image']}")
            else:
                dest = out / "assets" / src.name
                if src.resolve() != dest.resolve():
                    shutil.copy(src, dest)
                ctx["image"] = f"assets/{src.name}"
        parts.append(render_tpl(tpl_path.read_text(), ctx))
    accent = meta.get("accent")
    accent_css = f"<style>:root{{--accent:{html.escape(accent)};}}</style>" if accent else ""
    accent_css += brand_kit_css(meta)
    parts = [brand_kit_marks(p, meta, out, assets_dir, problems) for p in parts]
    deck = out / "deck.html"
    deck.write_text(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<title>{html.escape(meta.get('title', 'Carousel'))}</title>"
        f"<link rel=\"stylesheet\" href=\"tokens.css\">{accent_css}</head><body>\n"
        + "\n".join(parts)
        + "\n</body></html>\n"
    )
    return deck, problems


# ---------------------------------------------------------------- rendering

CHECK_JS = """
([W, H, MIN]) => {
  const out = [];
  document.querySelectorAll('section.slide').forEach((slide, i) => {
    const n = i + 1, r = slide.getBoundingClientRect();
    slide.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const hasText = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
      if (hasText && parseFloat(cs.fontSize) < MIN) out.push(`slide ${n}: "${el.textContent.trim().slice(0, 40)}" is ${cs.fontSize} (min ${MIN}px)`);
      const b = el.getBoundingClientRect();
      if (hasText && (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1 || b.top < r.top - 1))
        out.push(`slide ${n}: "${el.textContent.trim().slice(0, 40)}" runs off the slide`);
      if (el.scrollHeight > el.clientHeight + 2 && cs.overflow !== 'visible' && el.clientHeight > 0 && el.tagName !== 'IMG')
        out.push(`slide ${n}: content overflows its box: "${el.textContent.trim().slice(0, 40)}"`);
    });
    const img = slide.querySelector('img');
    if (img && !img.complete) out.push(`slide ${n}: image did not load`);
    if (img && img.complete && img.naturalWidth === 0) out.push(`slide ${n}: image is broken`);
  });
  return out;
}
"""


def _browser() -> str | None:
    for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return mac if os.path.exists(mac) else None


def _ensure_playwright() -> None:
    try:
        import playwright  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)


def render(deck: Path, out: Path) -> dict:
    _ensure_playwright()
    from playwright.sync_api import sync_playwright

    slides_dir = out / "slides"
    if slides_dir.exists():
        shutil.rmtree(slides_dir)
    slides_dir.mkdir(parents=True)
    with sync_playwright() as p:
        exe = _browser()
        try:
            browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        except Exception:
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
            browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": W + 200, "height": H + 200}, device_scale_factor=1)
        page.goto(deck.resolve().as_uri())
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        problems = page.evaluate(CHECK_JS, [W, H, MIN_FONT_PX])
        shots = []
        for i, el in enumerate(page.query_selector_all("section.slide"), start=1):
            path = slides_dir / f"{i:02d}.png"
            el.screenshot(path=str(path))
            shots.append(path)
        pdf = out / "deck.pdf"
        page.add_style_tag(content="@page{size:1080px 1350px;margin:0} html,body{background:none;padding:0;gap:0} .slide{break-after:page}")
        page.pdf(path=str(pdf), width=f"{W}px", height=f"{H}px", print_background=True,
                 margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        sheet = out / "sheet.png"
        tiles = "".join(f'<img src="{s.resolve().as_uri()}">' for s in shots)
        sheet_html = out / "_sheet.html"
        sheet_html.write_text(
            "<html><body style='margin:0;background:#1d201f;padding:24px;display:grid;"
            "grid-template-columns:repeat(4,270px);gap:16px;width:max-content'>"
            "<style>img{width:270px;height:337px;border-radius:10px;display:block}</style>"
            f"{tiles}</body></html>"
        )
        page.set_viewport_size({"width": 4 * 270 + 3 * 16 + 48, "height": 600})
        page.goto(sheet_html.resolve().as_uri())
        page.wait_for_load_state("load")
        page.screenshot(path=str(sheet), full_page=True)
        sheet_html.unlink()
        browser.close()
    return {"slides": [str(s) for s in shots], "pdf": str(pdf), "sheet": str(sheet), "problems": problems}


# ---------------------------------------------------------------- cli

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["check", "compose", "build"])
    ap.add_argument("spec")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--templates", default=str(HERE))
    ap.add_argument("--assets", default=None)
    a = ap.parse_args()

    templates = Path(a.templates)
    layouts = json.loads((templates / "carousel" / "layouts.json").read_text())
    spec = parse_spec(Path(a.spec).read_text())
    problems = validate(spec, layouts)
    result: dict = {"slides_in_spec": len(spec["slides"]), "problems": problems}

    if a.command in ("compose", "build"):
        if not a.out:
            ap.error("compose/build need an OUT folder")
        out = Path(a.out)
        deck, more = compose(spec, templates, out, Path(a.assets) if a.assets else None)
        problems += more
        result["deck"] = str(deck)
        if a.command == "build":
            r = render(deck, out)
            problems += r.pop("problems")
            result.update(r)
    result["problems"] = problems
    print(json.dumps(result, indent=2))
    return 2 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

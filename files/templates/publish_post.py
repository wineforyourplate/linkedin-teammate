#!/usr/bin/env python3
"""Post an approved draft in the person's LinkedIn browser, with the text checked by code.

    python3 /templates/publish_post.py compose  --draft <draft_id>
        Open a fresh composer and put exactly the draft's text in it. Types nothing else.
    python3 /templates/publish_post.py post     --draft <draft_id>
        In one step: check the composer holds exactly that text, then click Post.
        Clicks nothing if the text differs, by so much as a line.
    python3 /templates/publish_post.py readback [--url <post url>]
        Read the newest post on their profile (or the post at --url) back, to hand
        to function_publish_guard stage "after".

Each command prints one JSON line. The text comes from the draft itself (through
the `lemma` CLI), and only once function_publish_guard stage "before" has passed
and only if it is still the text the publish run claimed. If the CLI can't read
the draft, pass `--text-file <file> --sha <sha>` instead: the guard's `text`
written to a file as is, and its `sha`. A text that doesn't hash to that sha is
refused, so a copy that changed on the way never reaches the composer.

Why one script: on 26 Oct 2026 several runs typed test strings into the live
composer and clicked by stale refs, and "P1" / "P2" went out in place of an
approved post. Post is clicked here only, inside the same browser call that
checks the text.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time

FEED = "https://www.linkedin.com/feed/"
ACTIVITY = ("https://www.linkedin.com/in/me/recent-activity/shares/", "https://www.linkedin.com/in/me/recent-activity/all/")

# The same idea as publish_guard.normalize: one line per paragraph, spacing and invisible characters ignored.
NORM_JS = r"""const norm = s => (s || '').normalize('NFC').replace(/[​‌‍⁠﻿]/g, '')
  .replace(/ /g, ' ').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');"""
EDITORS_JS = "const editors = () => [...document.querySelectorAll('div.ProseMirror[contenteditable=\"true\"], [role=\"textbox\"][contenteditable=\"true\"]')].filter((e, i, a) => a.findIndex(x => x.contains(e) || e.contains(x)) === i);"

STATE = "(() => { %s return JSON.stringify({url: location.href, editors: editors().length}); })()" % EDITORS_JS
START = r"""(() => {
  const el = [...document.querySelectorAll('button, [role="button"], p, span')].find(e => /^start a post$/i.test((e.textContent || '').trim()));
  if (!el) return 'no-start-button';
  (el.closest('button, [role="button"]') || el).click();
  return 'clicked';
})()"""


def fill_js(text: str) -> str:
    return """(() => { %s %s
  const want = %s;
  const eds = editors();
  if (eds.length !== 1) return JSON.stringify({ok: false, reason: eds.length + ' editors open'});
  const ed = eds[0];
  const clear = () => { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('delete'); };
  const lines = want.split('\\n');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paste = (types) => { clear(); const dt = new DataTransfer();
    for (const [k, v] of Object.entries(types)) dt.setData(k, v);
    ed.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); };
  // One paragraph per line and an empty one per blank line, as Enter, Enter would make: keeps the spacing.
  paste({'text/html': lines.map(l => '<p>' + esc(l) + '</p>').join(''), 'text/plain': want});
  if (norm(ed.innerText) !== norm(want)) paste({'text/plain': want});
  if (norm(ed.innerText) !== norm(want)) { clear(); document.execCommand('insertText', false, want); }
  const got = norm(ed.innerText);
  const spaced = JSON.stringify([...ed.children].map(c => c.textContent)) === JSON.stringify(lines);
  return JSON.stringify({ok: got === norm(want), spaced, chars: got.length, want: norm(want).length, head: got.slice(0, 80)});
})()""" % (NORM_JS, EDITORS_JS, json.dumps(text))


def post_js(text: str) -> str:
    return """(() => { %s %s
  const want = norm(%s);
  const eds = editors();
  if (eds.length !== 1) return JSON.stringify({clicked: false, reason: eds.length + ' editors open'});
  const got = norm(eds[0].innerText);
  if (got !== want) return JSON.stringify({clicked: false, reason: 'the composer does not hold the approved text', head: got.slice(0, 80)});
  const scope = eds[0].closest('[role="dialog"]') || document;
  const btns = [...scope.querySelectorAll('button')].filter(b => (b.innerText || '').trim() === 'Post'
    && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.offsetParent !== null);
  if (btns.length !== 1) return JSON.stringify({clicked: false, reason: btns.length + ' Post buttons'});
  btns[0].click();
  return JSON.stringify({clicked: true});
})()""" % (NORM_JS, EDITORS_JS, json.dumps(text))


AFTER_POST = "(() => { %s return JSON.stringify({editors: editors().length, success: /post successful/i.test(document.body.innerText || '')}); })()" % EDITORS_JS

MORE = r"""(() => {
  const card = [...document.querySelectorAll('main [role="listitem"], main article')].find(c => (c.innerText || '').length > 40);
  if (!card) return 'no-card';
  const b = [...card.querySelectorAll('button, [role="button"]')].find(x =>
    /^(…|\.\.\.)?\s*(see )?more$/i.test((x.innerText || '').trim()) || /see more/i.test(x.getAttribute('aria-label') || ''));
  if (!b) return 'no-more';
  b.click();
  return 'expanded';
})()"""

READ = r"""(() => {
  const card = [...document.querySelectorAll('main [role="listitem"], main article')].find(c => (c.innerText || '').length > 40);
  if (!card) return JSON.stringify({found: false, url: location.href});
  const sel = '[data-testid*="commentary" i], [class*="commentary" i], .update-components-text, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text';
  const box = card.querySelector(sel);
  const lines = (card.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const age = lines.find(l => /^(now|just now|\d+\s?[smhdw]|\d+\s?(sec|min|mins|minute|minutes|hour|hours|hr|hrs)( ago)?)(\s*[•·].*)?$/i.test(l)) || null;
  return JSON.stringify({found: true, url: location.href, age, text: box ? box.innerText : null, card: card.innerText});
})()"""


def ab(*args: str, timeout: int = 180) -> str:
    """One agent-browser call. Retries once when Chrome itself fell over (it restarts between runs)."""
    out = ""
    for attempt in range(2):
        try:
            p = subprocess.run(["agent-browser", *args], capture_output=True, text=True, timeout=timeout)
            out = ((p.stdout or "").strip() or (p.stderr or "").strip())
        except subprocess.TimeoutExpired:
            out = "✗ timeout"
        if not out.startswith("✗") or not re.search(r"Chrome exited|Failed to connect|DevToolsActivePort|timeout", out):
            return out
        time.sleep(20)
    return out


def ev(js: str):
    raw = ab("eval", js)
    try:
        value = json.loads(raw)
        return json.loads(value) if isinstance(value, str) and value[:1] in "{[" else value
    except Exception:
        return {"error": raw[:300]}


def done(result: dict, code: int = 0) -> None:
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(code)


def wait_for_editor(seconds: int = 30) -> dict:
    state = {}
    for _ in range(seconds // 2):
        state = ev(STATE)
        if isinstance(state, dict) and state.get("editors"):
            return state
        time.sleep(2)
    return state if isinstance(state, dict) else {}


def compose(text: str) -> None:
    ab("open", FEED)
    time.sleep(6)
    state = ev(STATE)
    state = state if isinstance(state, dict) else {}
    if not state.get("editors"):
        ev(START)
        state = wait_for_editor()
    if not state.get("editors"):
        ab("open", FEED + "?shareActive=true")
        state = wait_for_editor()
    if state.get("editors") != 1:
        done({"ok": False, "step": "compose", "reason": f"composer not ready ({state.get('editors', 0)} editors open)", "url": state.get("url")}, 2)
    time.sleep(1)
    filled = ev(fill_js(text))
    if not isinstance(filled, dict) or not filled.get("ok"):
        done({"ok": False, "step": "compose", "reason": "the text didn't land in the composer exactly", "detail": filled}, 2)
    done({"ok": True, "step": "compose", "chars": filled.get("chars"), "spaced": filled.get("spaced")})


def post(text: str) -> None:
    result = ev(post_js(text))
    if not isinstance(result, dict) or not result.get("clicked"):
        done({"clicked": False, "step": "post", "reason": (result or {}).get("reason") if isinstance(result, dict) else str(result)[:200], "detail": result}, 3)
    state = {}
    for _ in range(12):
        time.sleep(2)
        state = ev(AFTER_POST)
        if isinstance(state, dict) and (state.get("success") or state.get("editors") == 0):
            break
    confirmed = isinstance(state, dict) and bool(state.get("success") or state.get("editors") == 0)
    done({"clicked": True, "step": "post", "confirmed": confirmed})


def readback(url: str | None) -> None:
    targets = (url,) if url else ACTIVITY
    last = {}
    for target in targets:
        for _ in range(2):
            ab("open", target)
            time.sleep(9)
            if ev(MORE) == "expanded":
                time.sleep(1.5)
            last = ev(READ)
            on_page = bool(url) or "recent-activity" in (last.get("url") or "" if isinstance(last, dict) else "")
            if isinstance(last, dict) and last.get("found") and on_page:
                fresh = bool(url) or bool(re.match(r"^(now|just now|\d+\s?s|\d+\s?m\b|\d+\s?(sec|min|mins|minute|minutes))", last.get("age") or "", re.I))
                done({"found": True, "fresh": fresh, "age": last.get("age"), "text": last.get("text"), "card": last.get("card"), "url": last.get("url")})
    done({"found": False, "reason": "couldn't read the post back", "detail": last}, 4)


def sha(text: str) -> str:
    """Same fingerprint as post_clock and publish_guard."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def approved_text(args: argparse.Namespace) -> str:
    """The text to post: the draft's own body, only while it is the checked, claimed text."""
    if args.draft:
        try:
            p = subprocess.run(["lemma", "--json", "records", "get", "drafts", args.draft], capture_output=True, text=True, timeout=60)
            row = json.loads(p.stdout)
        except Exception as exc:
            done({"ok": False, "reason": f"couldn't read the draft ({str(exc)[:120]}): use --text-file and --sha"}, 1)
        claim = (row.get("results") or {}).get("publish") or {}
        body = (row.get("body") or "").strip()
        if row.get("status") != "publishing" or not claim.get("checked_at"):
            done({"ok": False, "reason": f"the draft is {row.get('status')} and hasn't passed function_publish_guard, so don't post it"}, 1)
        if sha(body) != claim.get("body_sha"):
            done({"ok": False, "reason": "the draft's text changed since it was claimed, so don't post it"}, 1)
        return body
    if not (args.text_file and args.sha):
        done({"ok": False, "reason": "give --draft <id>, or --text-file and --sha from function_publish_guard"}, 1)
    with open(args.text_file, encoding="utf-8") as f:
        body = f.read().strip()
    if sha(body) != args.sha.strip().lower():
        done({"ok": False, "reason": "the text file isn't the approved text (its sha differs), so don't post it"}, 1)
    return body


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("command", choices=("compose", "post", "readback"))
    parser.add_argument("--draft")
    parser.add_argument("--text-file")
    parser.add_argument("--sha")
    parser.add_argument("--url")
    args = parser.parse_args()
    if args.command == "readback":
        readback(args.url)
    (compose if args.command == "compose" else post)(approved_text(args))

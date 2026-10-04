"""
locate.py
~~~~~~~~~
Finds where each extracted record sits on the page, so the UI can highlight
it on the screenshot.

Works on the layout captured with the screenshot (``navigator.LAYOUT_JS``):
``els`` (element boxes with parent indexes) and ``texts`` (visible text and
title/alt/aria-label, each with the element holding it). For each record:

1. find the page's repeated blocks: 3+ sibling elements of the same width
   (book tiles, job cards, table rows);
2. find the elements whose text matches each of the record's values;
3. give each record the block holding the most of its values, best
   matches first, never the same or a nested block twice.

Records whose values can't be found together (fewer than two, unless the
record has a single field) get no box: a wrong highlight is worse than none.

A placed record also gets ``href``: the link to the item itself, taken from
its block (``links`` in the layout), so the UI can open the real item page
without asking the model for URLs.
"""

import re
from typing import Any

from scraper.distiller import ACTION_HREF_RE

#: A record's box may cover at most this share of the captured page area.
MAX_AREA_SHARE = 0.3
#: Boxes under this share of the page's typical item size are dropped.
MIN_AREA_SHARE = 0.2
#: Values found in more places than this say little about where a record is.
MAX_MATCHES = 60


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _needles(value: Any) -> list[str]:
    """Strings to look for on the page for one field value."""
    if isinstance(value, bool) or value is None:
        return []
    if isinstance(value, (int, float)):
        out = {str(value), f"{value:,}"}
        if isinstance(value, float):
            out |= {f"{value:.2f}", f"{value:,.2f}"}
            if value.is_integer():
                out.add(str(int(value)))
        return [s for s in out if len(s) >= 2]
    if isinstance(value, str):
        v = _norm(value)
        return [v] if len(v) >= 3 else []
    return []


def _values(record: Any) -> list[list[str]]:
    """Needles per field (a list field contributes each item as its own value)."""
    if not isinstance(record, dict):
        return [n for n in [_needles(record)] if n]
    found: list[list[str]] = []
    for value in record.values():
        if isinstance(value, list):
            found += [n for n in (_needles(v) for v in value[:8]) if n]
        else:
            n = _needles(value)
            if n:
                found.append(n)
    return found


def _matches(needles: list[str], text: str) -> bool:
    for n in needles:
        if n in text:
            return True
        # A shortened label on the page ("A Light in the ...") for a full value.
        short = text.rstrip(". …").strip()
        if len(short) >= 8 and short != text and n.startswith(short):
            return True
    return False


class _Tree:
    def __init__(self, layout: dict):
        self.els = layout["els"]
        self.texts = [(_norm(t["t"]), t["e"]) for t in layout["texts"]]
        self._chains: dict[int, list[int]] = {}

    def chain(self, e: int) -> list[int]:
        """*e* and its ancestors, innermost first."""
        if e not in self._chains:
            out, node = [], e
            while node != -1 and len(out) < 200:
                out.append(node)
                node = self.els[node]["p"]
            self._chains[e] = out
        return self._chains[e]

    def inside(self, e: int, node: int) -> bool:
        return node in self.chain(e)

    def area(self, e: int) -> int:
        b = self.els[e]
        return b["w"] * b["h"]


def _repeated_blocks(tree: "_Tree") -> set[int]:
    """Elements that look like items in a list: 3+ siblings of the same width.

    Book tiles, job cards and table rows all repeat like this; a record is
    only ever highlighted on one of these.
    """
    children: dict[int, list[int]] = {}
    for e, el in enumerate(tree.els):
        if el["w"] >= 8 and el["h"] >= 8:
            children.setdefault(el["p"], []).append(e)
    blocks: set[int] = set()
    for kids in children.values():
        if len(kids) < 3:
            continue
        by_width: dict[int, list[int]] = {}
        for e in kids:
            by_width.setdefault(round(tree.els[e]["w"] / 8), []).append(e)
        for group in by_width.values():
            if len(group) >= 3:
                blocks.update(group)
    return blocks


def locate_records(records: list[Any], layout: dict | None) -> dict[int, dict]:
    """``{record index: {"x", "y", "w", "h"}}`` for the records found on the page."""
    if not layout or not layout.get("els") or not records:
        return {}
    tree = _Tree(layout)
    page_w = max((e["x"] + e["w"] for e in tree.els), default=1)
    page_h = max((e["y"] + e["h"] for e in tree.els), default=1)
    max_area = MAX_AREA_SHARE * page_w * page_h
    blocks = {b for b in _repeated_blocks(tree) if tree.area(b) <= max_area}
    if not blocks:
        return {}

    # For each record and block: how many of the record's values the block holds.
    options = []
    for index, record in enumerate(records):
        vals = _values(record)
        hits = []
        for needles in vals:
            els = {e for text, e in tree.texts if _matches(needles, text)}
            if els and len(els) <= MAX_MATCHES:
                hits.append(els)
        # Two values found together, unless the record only has one.
        need = 2 if len(vals) >= 2 else 1
        if len(hits) < need:
            continue
        cover: dict[int, int] = {}
        for els in hits:
            holders = {b for e in els for b in tree.chain(e) if b in blocks}
            for b in holders:
                cover[b] = cover.get(b, 0) + 1
        for b, n in cover.items():
            if n >= need:
                options.append((-n, index, tree.area(b), b))

    # Best matches first; one block per record, none overlapping another.
    boxes: dict[int, dict] = {}
    # Ties go to the earlier record: look-alike jobs are listed in page order.
    for _, index, _, b in sorted(options):
        el = tree.els[b]
        box = {"x": el["x"], "y": el["y"], "w": el["w"], "h": el["h"]}
        if index in boxes or any(_overlap(box, other) > 0.5 for other in boxes.values()):
            continue
        boxes[index] = box
        href = _item_link(tree, b, records[index], layout)
        if href:
            box["href"] = href

    # A box far smaller than the page's usual item is a stray match.
    if len(boxes) >= 3:
        areas = sorted(bx["w"] * bx["h"] for bx in boxes.values())
        typical = areas[len(areas) // 2]
        boxes = {i: bx for i, bx in boxes.items() if bx["w"] * bx["h"] >= MIN_AREA_SHARE * typical}
    return boxes


def _item_link(tree: "_Tree", block: int, record: Any, layout: dict) -> str | None:
    """The link that leads to the record's own page, if its block has one.

    Links inside the block (or wrapped around it) are candidates; action
    links (vote, log in...) and links back to the page itself are not. A
    link whose text is one of the record's values (usually the title) wins,
    then a link wrapped around the whole block, then the first in the block.
    """
    page = (layout.get("url") or "").split("#")[0]
    needles = _values(record)
    best, best_score = None, -1
    for link in layout.get("links") or []:
        href = link.get("h") or ""
        e = link.get("e")
        if not isinstance(e, int) or not 0 <= e < len(tree.els):
            continue
        if not href.startswith(("http://", "https://")) or ACTION_HREF_RE.search(href):
            continue
        if href.split("#")[0] == page:
            continue
        if tree.inside(e, block):
            text = _norm(link.get("t") or "")
            score = 2 if text and any(_matches(n, text) for n in needles) else 0
        elif tree.inside(block, e):
            score = 1
        else:
            continue
        if score > best_score:  # ties: the first in page order
            best, best_score = href, score
    return best


def _overlap(a: dict, b: dict) -> float:
    """Shared area as a share of the smaller box."""
    w = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
    h = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
    if w <= 0 or h <= 0:
        return 0.0
    return w * h / max(1, min(a["w"] * a["h"], b["w"] * b["h"]))

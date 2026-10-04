"""
chunking.py
~~~~~~~~~~~
Splits long page text into parts the model can handle, and merges the items
extracted from neighbouring parts.

One request can't take a whole long page: Groq's free tier allows 8,000
tokens a minute, prompt and output together, so ~12,000 characters of page
text per request is the practical limit. Longer pages are read in parts that
overlap, so an item cut in two at a part boundary is whole in one of them.
"""

from typing import Any

#: Page text per request (~3,500 prompt tokens, leaving room for the output).
CHUNK_CHARS = 12_000
#: Text repeated at the start of the next part. Longer than one item on the
#: pages tested (a Naukri job is ~500 characters, a Hacker News story ~150).
OVERLAP_CHARS = 1_500
#: A last part shorter than this share of CHUNK_CHARS is added to the one
#: before instead (a footer isn't worth a request of its own).
MERGE_TAIL_SHARE = 0.25
#: How many items at the end of one part are compared with the start of the next.
#: The overlap can hold ~30 short items (table rows of ~50 characters).
BOUNDARY_ITEMS = 50


def split_text(text: str, size: int = CHUNK_CHARS, overlap: int = OVERLAP_CHARS) -> list[str]:
    """Split *text* into parts of about *size* characters, breaking at line ends.

    Each part after the first starts *overlap* characters before the end of
    the previous one.
    """
    if len(text) <= size * (1 + MERGE_TAIL_SHARE):
        return [text]

    parts: list[str] = []
    start = 0
    while True:
        if len(text) - start <= size * (1 + MERGE_TAIL_SHARE):
            parts.append(text[start:])
            return parts
        end = text.rfind("\n", start + size // 2, start + size) + 1
        if end == 0:
            end = start + size
        parts.append(text[start:end])
        next_start = text.find("\n", max(start + 1, end - overlap), end)
        start = next_start + 1 if next_start != -1 else end


def _normalise(value: Any) -> Any:
    if isinstance(value, str):
        return " ".join(value.split()).lower()
    if isinstance(value, list):
        return [_normalise(v) for v in value]
    if isinstance(value, dict):
        return {k: _normalise(v) for k, v in value.items()}
    return value


def _same_item(a: Any, b: Any) -> bool:
    """Whether *a* and *b* describe the same item, read twice in the overlap.

    Every field both have a value for must match (ignoring case and spacing),
    so look-alike items that differ in any field (a dozen "AI / ML Engineer"
    jobs at one company with different experience) are kept apart. A field
    one side has as null counts as unknown, not different: an item at the
    edge of a part can come back with fields missing.
    """
    if not (isinstance(a, dict) and isinstance(b, dict)):
        return _normalise(a) == _normalise(b)
    shared = 0
    for key in a.keys() & b.keys():
        if a[key] is None or b[key] is None:
            continue
        if _normalise(a[key]) != _normalise(b[key]):
            return False
        shared += 1
    return shared > 0


def merge_items(items: list[Any], new_items: list[Any]) -> list[Any]:
    """*new_items* without those already in *items* from the overlap.

    Only the first :data:`BOUNDARY_ITEMS` new items are checked, against the
    last :data:`BOUNDARY_ITEMS` kept ones: identical items further apart are
    separate entries on the page. When a repeat has values the kept copy
    lacks (null there), they are filled in.
    """
    tail = items[-BOUNDARY_ITEMS:]
    fresh: list[Any] = []
    for index, item in enumerate(new_items):
        match = None
        if index < BOUNDARY_ITEMS:
            match = next((kept for kept in tail if _same_item(kept, item)), None)
        if match is None:
            fresh.append(item)
            continue
        tail.remove(match)  # one repeat per kept item
        if isinstance(match, dict) and isinstance(item, dict):
            for key, value in item.items():
                if match.get(key) is None and value is not None:
                    match[key] = value
    return fresh


#: Lines after the last item that repeat values the items share ("Accenture",
#: "2-5 Yrs") before the text after the last item counts as unread items.
REST_MIN_HITS = 3


def _key_value(item: Any) -> str | None:
    """The item's longest text value (usually its title), for finding it in the page text."""
    if not isinstance(item, dict):
        return None
    texts = [v for v in item.values() if isinstance(v, str) and len(v.strip()) >= 4]
    return _normalise(max(texts, key=len)) if texts else None


def rest_after(text: str, items: list[Any]) -> str | None:
    """The page text from the last extracted item on, if more items follow it.

    The model sometimes stops early on a long run of look-alike items (13
    near-identical "AI / ML Engineer" jobs at the end of a Naukri page). The
    items are found in the text in order; after the last one (and one usual
    item length past it), lines equal to values that two or more items share
    mean more items are there. A footer has none, so it costs no request.
    """
    lower = text.lower()
    starts: list[int] = []
    cursor = 0
    for item in items:
        key = _key_value(item)
        pos = lower.find(key, cursor) if key else -1
        if pos != -1:
            starts.append(pos)
            cursor = pos + 1
    if len(starts) < 2:
        return None

    gaps = sorted(b - a for a, b in zip(starts, starts[1:]))
    span = gaps[len(gaps) // 2]  # a usual item's length
    counts: dict[str, int] = {}
    for item in items:
        if isinstance(item, dict):
            for v in {_normalise(v) for v in item.values() if isinstance(v, str)}:
                counts[v] = counts.get(v, 0) + 1
    shared = {v for v, n in counts.items() if n >= 2 and len(v) >= 2}
    wanted = shared | ({_key_value(item) for item in items} - {None})
    after = text[starts[-1] + span:]
    hits = sum(1 for line in after.splitlines() if _normalise(line) in wanted)
    if hits < REST_MIN_HITS:
        return None
    line_start = text.rfind("\n", 0, starts[-1]) + 1
    return text[line_start:]

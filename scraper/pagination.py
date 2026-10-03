"""
pagination.py
~~~~~~~~~~~~~
Find a page's "next page" link so the pipeline can follow it.
"""

import re
from urllib.parse import urldefrag, urljoin

from bs4 import BeautifulSoup, Tag

# Link text that means "next page" once arrows and whitespace are stripped.
NEXT_TEXT_RE = re.compile(r"^(next|next page|more|older posts|load more)$", re.IGNORECASE)
ARROWS_RE = re.compile(r"[\s›»→>]+")
NEXT_CLASS_RE = re.compile(r"(^|[\s_-])next($|[\s_-])|morelink", re.IGNORECASE)
DISABLED_RE = re.compile(r"disabled|inactive", re.IGNORECASE)


def find_next_page(raw_html: str, page_url: str) -> str | None:
    """Return the absolute URL of the next page, or ``None`` if there isn't one.

    Checked in order of reliability:

    1. ``rel="next"`` on an ``<a>`` or ``<link>`` (Hacker News, many CMSs).
    2. An ``<a>`` whose own class, or whose parent's class, says "next"
       (``<li class="next"><a ...>`` on Books/Quotes to Scrape).
    3. An ``<a>`` whose text or ``aria-label`` is "Next", "Next →", "More"...

    Disabled links and links back to the current page are ignored.
    """
    soup = BeautifulSoup(raw_html, "lxml")
    current = urldefrag(page_url)[0]

    for finder in (_by_rel, _by_class, _by_text):
        for tag in finder(soup):
            href = (tag.get("href") or "").strip()
            if not href or href.startswith(("#", "javascript:")) or _is_disabled(tag):
                continue
            url = urldefrag(urljoin(page_url, href))[0]
            if url != current:
                return url
    return None


def _by_rel(soup: BeautifulSoup) -> list[Tag]:
    return [t for t in soup.find_all(["a", "link"], href=True) if "next" in (t.get("rel") or [])]


def _by_class(soup: BeautifulSoup) -> list[Tag]:
    found = []
    for a in soup.find_all("a", href=True):
        classes = " ".join(a.get("class", []) + (a.parent.get("class", []) if isinstance(a.parent, Tag) else []))
        if NEXT_CLASS_RE.search(classes):
            found.append(a)
    return found


def _by_text(soup: BeautifulSoup) -> list[Tag]:
    found = []
    for a in soup.find_all("a", href=True):
        label = a.get("aria-label") or a.get_text(" ", strip=True)
        if NEXT_TEXT_RE.match(ARROWS_RE.sub(" ", label).strip()):
            found.append(a)
    return found


def _is_disabled(tag: Tag) -> bool:
    if tag.has_attr("disabled") or tag.get("aria-disabled") == "true":
        return True
    classes = " ".join(tag.get("class", []) + (tag.parent.get("class", []) if isinstance(tag.parent, Tag) else []))
    return bool(DISABLED_RE.search(classes))

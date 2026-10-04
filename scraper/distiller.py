"""
distiller.py
~~~~~~~~~~~~
HTML-to-clean-text distiller using BeautifulSoup.
"""

import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

REMOVE_TAGS = [
    "script", "style", "meta", "link", "noscript",
    "footer", "nav", "aside", "iframe",
    "svg",
]

# Class names that carry data on otherwise empty elements, e.g. Books to
# Scrape's <p class="star-rating Three"> with only icons inside.
DATA_CLASS_RE = re.compile(r"rating|stock|availab|status|badge", re.IGNORECASE)

# Link and image URLs are long, so they're only kept when the requested
# fields look like they need them.
WANTS_LINKS_RE = re.compile(r"url|link|href|website", re.IGNORECASE)
WANTS_IMAGES_RE = re.compile(r"image|img|photo|picture|thumbnail|logo|avatar", re.IGNORECASE)


def wanted_attributes(schema_description: str) -> dict[str, bool]:
    """Decide from the user's field description which URLs are worth their length."""
    schema_description = schema_description or ""
    return {
        "keep_links": bool(WANTS_LINKS_RE.search(schema_description)),
        "keep_image_urls": bool(WANTS_IMAGES_RE.search(schema_description)),
    }

# hrefs that don't point anywhere useful.
SKIP_HREF_RE = re.compile(r"^\s*(#|javascript:|$)", re.IGNORECASE)

# Links that perform an action rather than lead to content (vote, hide, log in...).
ACTION_HREF_RE = re.compile(
    r"(^|[/?&])(vote|upvote|downvote|hide|flag|fave|login|logout|signin|signup|register|auth)\b"
    r"|[?&](how|auth|goto)=",
    re.IGNORECASE,
)

LINK_HEADER = "Page URL: {url} (links shown as /path are on this site; give full URLs in the output)\n\n"

# <header> tags inside these are content (e.g. an article's title), not chrome.
CONTENT_CONTAINERS = ["article", "main", "section"]

# Total page text kept. Long pages are sent to the model in parts
# (scraper.chunking), so this is ~3 requests' worth, not one.
MAX_CHARS = 40_000
TRUNCATION_SUFFIX = "... [TRUNCATED]"


class Distiller:
    """Converts raw HTML into clean, LLM-ready plain text.

    The distiller strips boilerplate markup (scripts, styles, navigation,
    etc.), collapses whitespace, and hard-truncates the output so it fits
    within a reasonable LLM context window.
    """

    def __init__(self, max_chars: int = MAX_CHARS) -> None:
        self.max_chars = max_chars
        #: Set by :meth:`distill` — ``True`` when the last page was cut off.
        self.truncated = False
        #: Length of the last page's text before truncation.
        self.full_length = 0

    def distill(
        self,
        raw_html: str,
        base_url: str | None = None,
        keep_links: bool = False,
        keep_image_urls: bool = False,
    ) -> str:
        """Parse *raw_html* and return sanitised plain text.

        Processing steps:

        1. Parse with BeautifulSoup using the ``lxml`` parser.
        2. Decompose noisy tags: ``<script>``, ``<style>``, ``<meta>``,
           ``<link>``, ``<noscript>``, ``<footer>``, ``<nav>``,
           ``<aside>``, ``<iframe>``, ``<svg>``, and page-level
           ``<header>`` (headers inside ``<article>``/``<main>``/``<section>``
           often hold item titles, so those are kept).
        3. Strip all HTML comments.
        4. Keep data that lives in attributes rather than text:
           images become ``[image: alt]``, ``title``/``aria-label``
           values missing from the text are added in brackets, and empty
           elements with data-like classes become ``[star-rating Three]``.
           With *keep_links*, links become ``text <absolute url>`` (each URL
           shown once); with *keep_image_urls*, images get ``<src>`` too.
        5. Extract text with ``\\n`` separator and per-element stripping.
        6. Collapse consecutive blank lines to a single blank line.
        7. Truncate to ``max_chars`` characters, appending
           ``'... [TRUNCATED]'`` and setting :attr:`truncated` when the limit
           is exceeded.

        Args:
            raw_html: The full HTML source of a web page.
            base_url: The page's URL, used to make relative links absolute.
            keep_links: Include link targets. See :func:`wanted_attributes`.
            keep_image_urls: Include image ``src`` URLs.

        Returns:
            Clean, human-readable text suitable for LLM consumption.
        """
        soup = BeautifulSoup(raw_html, "lxml")

        # Remove noisy structural / resource tags
        for tag_name in REMOVE_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        for tag in soup.find_all("header"):
            if not tag.find_parent(CONTENT_CONTAINERS):
                tag.decompose()

        # Remove HTML comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Surface data stored in attributes (order matters: links flatten
        # their contents, so images/titles inside them are handled first).
        _inline_images(soup, base_url if keep_image_urls else None, keep_image_urls)
        _inline_labels(soup)
        _inline_data_classes(soup)
        if keep_links:
            _inline_links(soup, base_url)

        # Extract plain text
        text: str = soup.get_text(separator="\n", strip=True)

        # Collapse multiple consecutive blank lines into one
        text = re.sub(r"\n{3,}", "\n\n", text)

        if keep_links and base_url:
            text = LINK_HEADER.format(url=base_url) + text

        # Truncate if necessary
        self.full_length = len(text)
        self.truncated = len(text) > self.max_chars
        if self.truncated:
            text = text[: self.max_chars] + TRUNCATION_SUFFIX

        return text


def _resolve(url: str, base_url: str | None) -> str:
    return urljoin(base_url, url.strip()) if base_url else url.strip()


def _inline_images(soup: BeautifulSoup, base_url: str | None, keep_src: bool) -> None:
    """Replace ``<img>`` with ``[image: alt <src>]``, or drop it if there's nothing to say."""
    for img in soup.find_all("img"):
        alt = (img.get("alt") or "").strip()
        src = (img.get("src") or "") if keep_src else ""
        if src.startswith("data:"):
            src = ""
        parts = ["image:"] + ([alt] if alt else []) + ([f"<{_resolve(src, base_url)}>"] if src else [])
        img.replace_with(NavigableString(f"[{' '.join(parts)}]") if len(parts) > 1 else "")


def _inline_labels(soup: BeautifulSoup) -> None:
    """Add ``title``/``aria-label`` text the visible text doesn't already contain.

    Catches truncated titles ("A Light in the ..." with the full title in
    ``title``) and icon-only elements labelled for screen readers.
    """
    for tag in soup.find_all(lambda t: t.has_attr("title") or t.has_attr("aria-label")):
        visible = tag.get_text(" ", strip=True)
        for attr in ("title", "aria-label"):
            label = (tag.get(attr) or "").strip()
            if label and label.lower() not in visible.lower():
                tag.append(NavigableString(f" [{label}]"))
                visible += f" {label}"


def _inline_data_classes(soup: BeautifulSoup) -> None:
    """Expose data-like class names on elements that have no text of their own."""
    for tag in soup.find_all(class_=DATA_CLASS_RE):
        if not tag.get_text(strip=True):
            tag.append(NavigableString(f"[{' '.join(tag.get('class', []))}]"))


def _inline_links(soup: BeautifulSoup, base_url: str | None) -> None:
    """Replace each link with ``text <url>`` on one line.

    To keep the text short: links without text or that perform an action
    (vote, hide, log in) get no URL, a URL already shown isn't repeated, and
    same-site URLs are written as paths (the caller adds the page URL once).
    """
    origin = _origin(base_url)
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag) or SKIP_HREF_RE.match(a["href"]):
            continue
        text = a.get_text(" ", strip=True)
        url = _resolve(a["href"], base_url)
        if not text or ACTION_HREF_RE.search(url) or url in seen or text == url:
            a.replace_with(NavigableString(text))
            continue
        seen.add(url)
        shown = url[len(origin):] if origin and url.startswith(origin + "/") else url
        a.replace_with(NavigableString(f"{text} <{shown}>"))


def _origin(url: str | None) -> str:
    """``https://host[:port]`` of *url*, or ``""``."""
    parts = urlsplit(url or "")
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else ""

"""
distiller.py
~~~~~~~~~~~~
HTML-to-clean-text distiller using BeautifulSoup.
"""

import re
from bs4 import BeautifulSoup, Comment

REMOVE_TAGS = [
    "script", "style", "meta", "link", "noscript",
    "footer", "nav", "aside", "iframe",
    "svg", "img",
]

# <header> tags inside these are content (e.g. an article's title), not chrome.
CONTENT_CONTAINERS = ["article", "main", "section"]

MAX_CHARS = 12_000
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

    def distill(self, raw_html: str) -> str:
        """Parse *raw_html* and return sanitised plain text.

        Processing steps:

        1. Parse with BeautifulSoup using the ``lxml`` parser.
        2. Decompose noisy tags: ``<script>``, ``<style>``, ``<meta>``,
           ``<link>``, ``<noscript>``, ``<footer>``, ``<nav>``,
           ``<aside>``, ``<iframe>``, ``<svg>``, ``<img>``, and page-level
           ``<header>`` (headers inside ``<article>``/``<main>``/``<section>``
           often hold item titles, so those are kept).
        3. Strip all HTML comments.
        4. Extract text with ``\\n`` separator and per-element stripping.
        5. Collapse consecutive blank lines to a single blank line.
        6. Truncate to ``max_chars`` characters, appending
           ``'... [TRUNCATED]'`` and setting :attr:`truncated` when the limit
           is exceeded.

        Args:
            raw_html: The full HTML source of a web page.

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

        # Extract plain text
        text: str = soup.get_text(separator="\n", strip=True)

        # Collapse multiple consecutive blank lines into one
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Truncate if necessary
        self.full_length = len(text)
        self.truncated = len(text) > self.max_chars
        if self.truncated:
            text = text[: self.max_chars] + TRUNCATION_SUFFIX

        return text

import pytest

from scraper.pagination import find_next_page

BASE = "https://site.test/list/page-1.html"


@pytest.mark.parametrize(
    "html, expected",
    [
        # Books to Scrape / Quotes to Scrape
        ('<li class="next"><a href="page-2.html">next</a></li>', "https://site.test/list/page-2.html"),
        ('<li class="next"><a href="/page/2/">Next <span>→</span></a></li>', "https://site.test/page/2/"),
        # Hacker News
        ('<a href="?p=2" class="morelink" rel="next">More</a>', "https://site.test/list/page-1.html?p=2"),
        ('<link rel="next" href="/list/page-2.html">', "https://site.test/list/page-2.html"),
        ('<a class="pagination__next" href="/p2">›</a>', "https://site.test/p2"),
        ('<a aria-label="Next page" href="/p2"><svg></svg></a>', "https://site.test/p2"),
        ('<a href="/p2">Next »</a>', "https://site.test/p2"),
        ('<a href="/p2">Load more</a>', "https://site.test/p2"),
    ],
)
def test_finds_next_link(html, expected):
    assert find_next_page(html, BASE) == expected


@pytest.mark.parametrize(
    "html",
    [
        "<p>No pagination here</p>",
        '<a href="/next-steps">Next steps for your account</a>',  # not a pager
        '<li class="next disabled"><a href="#">next</a></li>',
        '<a class="next" aria-disabled="true" href="/p2">next</a>',
        '<a class="next" href="page-1.html">next</a>',  # points back at this page
        '<a class="next" href="javascript:void(0)">next</a>',
    ],
)
def test_no_next_link(html):
    assert find_next_page(html, BASE) is None


def test_prefers_rel_next_over_text():
    html = '<a href="/wrong">Next</a><a rel="next" href="/right">2</a>'
    assert find_next_page(html, BASE) == "https://site.test/right"

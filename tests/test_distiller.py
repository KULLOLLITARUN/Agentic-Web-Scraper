import pytest

from scraper.distiller import LINK_HEADER, TRUNCATION_SUFFIX, Distiller, wanted_attributes


def test_strips_page_chrome_but_keeps_content_headers():
    html = """
    <html><body>
      <header>SITE HEADER</header>
      <nav>menu</nav>
      <main><article><header><h2>Item title</h2></header><p>Item body</p></article></main>
      <footer>footer text</footer>
      <script>var x = 1;</script>
    </body></html>
    """
    text = Distiller().distill(html)

    assert "Item title" in text
    assert "Item body" in text
    for noise in ("SITE HEADER", "menu", "footer text", "var x"):
        assert noise not in text


def test_removes_comments_and_collapses_blank_lines():
    text = Distiller().distill("<p>a</p><!-- hidden --><br><br><br><br><p>b</p>")

    assert "hidden" not in text
    assert "\n\n\n" not in text


def test_short_page_is_not_truncated():
    d = Distiller(max_chars=1000)
    text = d.distill("<p>hello</p>")

    assert text == "hello"
    assert d.truncated is False
    assert d.full_length == 5


def test_long_page_is_truncated_and_flagged():
    d = Distiller(max_chars=1000)
    text = d.distill("<p>" + "x" * 5000 + "</p>")

    assert d.truncated is True
    assert d.full_length == 5000
    assert text == "x" * 1000 + TRUNCATION_SUFFIX


def test_truncation_flag_resets_between_pages():
    d = Distiller(max_chars=1000)
    d.distill("<p>" + "x" * 5000 + "</p>")
    d.distill("<p>short</p>")

    assert d.truncated is False


# ── Data kept from attributes ───────────────────────────────────────────────
BOOK = """
<article class="product_pod">
  <a href="catalogue/a-light_1000/index.html"><img src="media/a.jpg" alt="A Light in the Attic"></a>
  <p class="star-rating Three"><i class="icon-star"></i><i class="icon-star"></i></p>
  <h3><a href="catalogue/a-light_1000/index.html" title="A Light in the Attic">A Light in the ...</a></h3>
  <p class="price_color">£51.77</p>
  <p class="instock availability"><i class="icon-ok"></i> In stock</p>
</article>
"""


def lines(text):
    return [line for line in text.splitlines() if line]


def test_keeps_rating_class_full_title_and_image_alt_by_default():
    text = Distiller().distill(BOOK, "https://books.toscrape.com/")

    assert lines(text) == [
        "[image: A Light in the Attic]",
        "[star-rating Three]",
        "A Light in the ...",
        "[A Light in the Attic]",
        "£51.77",
        "In stock",
    ]


def test_links_and_image_urls_only_when_requested():
    text = Distiller().distill(BOOK, "https://books.toscrape.com/", keep_links=True, keep_image_urls=True)

    assert text.startswith(LINK_HEADER.format(url="https://books.toscrape.com/"))
    assert "[image: A Light in the Attic <https://books.toscrape.com/media/a.jpg>] </catalogue/a-light_1000/index.html>" in text
    # Same URL again on the title link: text only.
    assert "A Light in the ... [A Light in the Attic]\n" in text + "\n"
    assert text.count("a-light_1000") == 1


def test_link_formats():
    html = """
      <a href="https://other.site/story">Story</a>
      <a href="/item?id=1">12 comments</a>
      <a href="vote?id=1&how=up"><span title="upvote"></span></a>
      <a href="hide?id=1&goto=news">hide</a>
      <a href="/login">login</a>
      <a href="#top">Top</a>
      <a href="javascript:void(0)">Menu</a>
      <a href="/empty"></a>
    """
    text = Distiller().distill(html, "https://news.ycombinator.com/", keep_links=True)

    assert lines(text)[1:] == [
        "Story <https://other.site/story>",
        "12 comments </item?id=1>",
        "[upvote]",
        "hide",
        "login",
        "Top",
        "Menu",
    ]


def test_icon_classes_are_not_exposed():
    text = Distiller().distill('<p class="price"><i class="icon-star"></i>£5</p>')

    assert "icon" not in text


@pytest.mark.parametrize(
    "schema, links, images",
    [
        ("text (string), author (string)", False, False),
        ("title (string), url (string)", True, False),
        ("name (string), profile_link (string)", True, False),
        ("title (string), image (string)", False, True),
        ("company (string), logo_url (string)", True, True),
    ],
)
def test_wanted_attributes_follow_the_requested_fields(schema, links, images):
    assert wanted_attributes(schema) == {"keep_links": links, "keep_image_urls": images}

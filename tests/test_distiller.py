from scraper.distiller import Distiller, TRUNCATION_SUFFIX


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

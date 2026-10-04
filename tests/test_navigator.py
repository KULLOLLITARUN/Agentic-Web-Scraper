import asyncio
import time

from playwright.async_api import async_playwright

from scraper.navigator import Navigator

# These drive a real headless Chromium (playwright install chromium).

CLICK_LOG = "<script>function hit(n){document.body.dataset.clicked=(document.body.dataset.clicked||'')+n+';'}</script>"


async def clicked_after_dismiss(html):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(CLICK_LOG + html)
        start = time.perf_counter()
        await Navigator()._dismiss_cookie_banner(page)
        elapsed = time.perf_counter() - start
        clicked = await page.evaluate("document.body.dataset.clicked || ''")
        await browser.close()
        return clicked, elapsed


def test_clicks_visible_consent_button():
    clicked, _ = asyncio.run(clicked_after_dismiss(
        '<div id="banner">We use cookies <button onclick="hit(\'accept\')">Accept all</button></div>'
    ))
    assert clicked == "accept;"


def test_ignores_buttons_that_only_contain_a_label():
    clicked, _ = asyncio.run(clicked_after_dismiss(
        '<button onclick="hit(\'book\')">Book now</button><button onclick="hit(\'okay\')">Okay then</button>'
    ))
    assert clicked == ""


def test_ignores_hidden_consent_button():
    clicked, _ = asyncio.run(clicked_after_dismiss(
        '<button style="display:none" onclick="hit(\'hidden\')">Accept</button>'
    ))
    assert clicked == ""


def test_page_without_banner_is_fast():
    clicked, elapsed = asyncio.run(clicked_after_dismiss("<main><p>Just content</p></main>"))
    assert clicked == ""
    assert elapsed < 1.0


def test_screenshot_is_a_jpeg_of_the_page_top():
    from scraper.navigator import SCREENSHOT_MAX_HEIGHT

    async def shoot():
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": 800, "height": 600})
            await page.set_content('<div style="height:10000px;background:#eee">tall page</div>')
            shot = await Navigator()._screenshot(page)
            await browser.close()
            return shot

    shot = asyncio.run(shoot())
    assert shot["jpeg"][:2] == b"\xff\xd8"  # JPEG magic number
    assert shot["width"] == 800
    assert shot["height"] == SCREENSHOT_MAX_HEIGHT


def test_cookie_bar_is_hidden_for_the_screenshot():
    from scraper.navigator import HIDE_BANNERS_JS

    async def run():
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(
                '<header style="position:sticky;top:0">Shop</header><main>Products</main>'
                '<div id="bar" style="position:fixed;bottom:0;height:60px">We use cookies. <button>Got it</button></div>'
            )
            hidden = await page.evaluate(HIDE_BANNERS_JS)
            bar = await page.evaluate("getComputedStyle(document.getElementById('bar')).visibility")
            header = await page.evaluate("getComputedStyle(document.querySelector('header')).visibility")
            await browser.close()
            return hidden, bar, header

    hidden, bar, header = asyncio.run(run())
    assert (hidden, bar, header) == (1, "hidden", "visible")


GROWING_LIST = """
<ul id="list"><li>Item 1</li></ul>
<button id="more" onclick="
  const list = document.getElementById('list');
  list.insertAdjacentHTML('beforeend', '<li>Item ' + (list.children.length + 1) + '</li>');
  if (list.children.length >= 3) this.remove();
">Load more</button>
"""


async def presses_on(html, max_clicks=5, monkeypatch=None):
    if monkeypatch:
        import scraper.navigator as nav_module
        monkeypatch.setattr(nav_module, "LOAD_MORE_WAIT_MS", 0)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html)
        presses = await Navigator()._load_more(page, max_clicks)
        items = await page.evaluate("document.querySelectorAll('li').length")
        await browser.close()
        return presses, items


def test_presses_load_more_until_the_button_goes(monkeypatch):
    assert asyncio.run(presses_on(GROWING_LIST, monkeypatch=monkeypatch)) == (2, 3)


def test_load_more_stops_at_the_limit(monkeypatch):
    assert asyncio.run(presses_on(GROWING_LIST, max_clicks=1, monkeypatch=monkeypatch)) == (1, 2)


def test_view_more_and_next_page_links_are_not_pressed(monkeypatch):
    html = (
        "<ul><li>Item 1</li></ul>"
        "<button onclick=\"document.body.insertAdjacentHTML('beforeend', '<li>x</li>')\">View more</button>"
        "<a href='/page/2'>Load more</a>"
    )
    assert asyncio.run(presses_on(html, monkeypatch=monkeypatch)) == (0, 1)


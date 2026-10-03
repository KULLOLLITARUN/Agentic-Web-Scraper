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

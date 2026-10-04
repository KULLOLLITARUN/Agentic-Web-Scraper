"""
navigator.py
~~~~~~~~~~~~
Playwright-based async browser navigator with anti-bot stealth evasion,
cookie-banner auto-dismissal, and dynamic infinite-scroll / lazy-loading support.
"""

import logging
import re
from typing import Any
from playwright.async_api import (
    async_playwright,
    Page,
    Browser,
    BrowserContext,
    TimeoutError as PlaywrightTimeoutError,
)

logger = logging.getLogger("ai_scraper.navigator")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}

CHROMIUM_LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certificate-errors",
    "--ignore-certificate-errors-spki-list",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
]

STEALTH_INIT_SCRIPT = """
// 1. Mask navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});

// 2. Spoof window.chrome runtime object
window.chrome = {
    app: {
        isInstalled: false,
        InstallState: { DISABLED: 'DISABLED', INSTALLED: 'INSTALLED', NOT_INSTALLED: 'NOT_INSTALLED' },
        RunningState: { CANNOT_RUN: 'CANNOT_RUN', READY_TO_RUN: 'READY_TO_RUN', RUNNING: 'RUNNING' }
    },
    runtime: {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }
    },
    loadTimes: function() {},
    csi: function() {}
};

// 3. Spoof languages & realistic plugin arrays
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en']
});

Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
});

// 4. Permissions API query mock
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
);
"""

COOKIE_TEXTS = ["Accept All", "Accept", "I Agree", "Got it", "Allow all cookies", "OK", "Dismiss"]
# Whole-label match, so "OK" doesn't hit buttons like "Book now".
COOKIE_LABEL_RE = re.compile(
    r"^\s*(?:" + "|".join(re.escape(t) for t in COOKIE_TEXTS) + r")\s*$", re.IGNORECASE
)

# Extra settle time for client-side rendering, depending on whether the
# network went idle (page is likely done) or stayed busy (SPA still hydrating).
SETTLE_MS_AFTER_IDLE = 500
SETTLE_MS_STILL_BUSY = 3500

# Page screenshots for the UI: enough of the page for a whole results list
# (Naukri's 20 jobs: 6,632 px, 427 KB) without an endless feed (20,000+ px).
SCREENSHOT_MAX_HEIGHT = 8000
SCREENSHOT_QUALITY = 55

# Where things are on the page, for highlighting extracted records on the
# screenshot: every element (box + parent) that holds visible text, and
# that text, including title/alt/aria-label (Books to Scrape keeps full
# titles there). Only the screenshot's area, so the result stays small.
# Cookie/consent bars pinned to the screen cover the screenshot (Naukri's can
# appear after every dismissal attempt). Hidden only for the picture: the
# page text has already been read.
HIDE_BANNERS_JS = r"""
() => {
  let hidden = 0;
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height > innerHeight * 0.6 || r.height < 1) continue;
    if (/cookie|consent|gdpr|privacy policy/i.test(el.textContent || '')) {
      el.style.setProperty('visibility', 'hidden', 'important');
      hidden += 1;
    }
  }
  return hidden;
}
"""

LAYOUT_JS = r"""
(maxH) => {
  const els = [], texts = [], ids = new Map();
  const add = (el) => {
    if (ids.has(el)) return ids.get(el);
    const parent = el.parentElement && el.parentElement !== document.documentElement ? add(el.parentElement) : -1;
    const b = el.getBoundingClientRect();
    const i = els.length;
    els.push({p: parent, x: Math.round(b.left + scrollX), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height)});
    ids.set(el, i);
    return i;
  };
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node;
  while ((node = walker.nextNode()) && texts.length < 6000) {
    const t = node.textContent.replace(/\s+/g, ' ').trim();
    const parent = node.parentElement;
    if (!t || !parent || skip.has(parent.tagName)) continue;
    range.selectNodeContents(node);
    const b = range.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.top + scrollY > maxH) continue;
    texts.push({t: t.slice(0, 300), e: add(parent)});
  }
  for (const el of document.body.querySelectorAll('[title], img[alt], [aria-label]')) {
    if (texts.length >= 8000) break;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.top + scrollY > maxH) continue;
    for (const attr of ['title', 'alt', 'aria-label']) {
      const t = (el.getAttribute(attr) || '').replace(/\s+/g, ' ').trim();
      if (t) texts.push({t: t.slice(0, 300), e: add(el)});
    }
  }
  return {els, texts};
}
"""


class Navigator:
    """Async context manager that drives a stealth headless Chromium browser via Playwright.

    Features:
    - Stealth bot-detection evasion (masks webdriver, mocks chrome runtime, injects realistic headers).
    - Dynamic infinite-scroll and lazy-load trigger capability.
    - Automatic cookie/consent banner dismissal.
    - Resilient two-stage navigation fallback (survives hung analytics/websockets).

    Usage::

        async with Navigator() as nav:
            html = await nav.fetch("https://example.com", scroll=True, max_scrolls=5)
    """

    def __init__(self, headless: bool = True) -> None:
        self.headless = headless
        self._playwright = None
        self._browser: Browser | None = None
        #: Set by :meth:`fetch` when ``screenshot=True``; see :meth:`_screenshot`.
        self.last_screenshot: dict | None = None

    async def __aenter__(self) -> "Navigator":
        """Start the Playwright engine and launch Chromium with stealth settings."""
        self._playwright = await async_playwright().start()
        launch_kwargs = {
            "headless": self.headless,
            "args": CHROMIUM_LAUNCH_ARGS,
        }
        try:
            # Use installed Chrome channel when available for genuine browser fingerprint
            self._browser = await self._playwright.chromium.launch(channel="chrome", **launch_kwargs)
        except Exception:
            self._browser = await self._playwright.chromium.launch(**launch_kwargs)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Shut down the browser and Playwright engine."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def _dismiss_cookie_banner(self, page: Page) -> None:
        """Click a visible cookie-consent button, if there is one.

        All labels are checked in a single query that doesn't wait, so pages
        without a banner cost milliseconds instead of a timeout per label.
        """
        candidates = (
            page.get_by_role("button", name=COOKIE_LABEL_RE)
            .or_(page.get_by_role("link", name=COOKIE_LABEL_RE))
            .or_(page.get_by_text(COOKIE_LABEL_RE))
            .filter(visible=True)
        )
        try:
            if await candidates.count() == 0:
                return
            target = candidates.first
            label = (await target.inner_text(timeout=1000)).strip()
            await target.click(timeout=1500)
            logger.debug("Dismissed cookie banner: '%s'", label)
        except Exception as e:
            logger.debug("Cookie banner click skipped: %s", e)

    async def _scroll_page(
        self,
        page: Page,
        steps: int = 5,
        delay_ms: int = 800,
    ) -> None:
        """Perform progressive dynamic scrolling to trigger lazy-loaded content.

        Args:
            page: The active Playwright Page instance.
            steps: Number of scroll increments down the page.
            delay_ms: Wait duration in milliseconds after each scroll to let DOM hydrate.
        """
        logger.info("Triggering dynamic scrolling (%d steps, %dms delay)...", steps, delay_ms)
        for i in range(steps):
            try:
                # Scroll down by 85% of viewport height to trigger lazy-loaders
                await page.evaluate("window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' })")
                await page.wait_for_timeout(delay_ms)
            except Exception as e:
                logger.debug("Scroll step %d encountered notice: %s", i + 1, e)
                break

        # Brief settle pause after scrolling completes
        try:
            await page.wait_for_timeout(500)
        except Exception:
            pass

    async def _screenshot(self, page: Page) -> dict | None:
        """JPEG of the page's top (up to SCREENSHOT_MAX_HEIGHT px), or None if it fails.

        Returns ``{"jpeg": bytes, "width": int, "height": int, "layout": dict | None}``
        (layout: see LAYOUT_JS). Taken after scrolling, back at the top, so
        lazy images are loaded.
        """
        try:
            await page.evaluate("window.scrollTo(0, 0)")
            try:
                if await page.evaluate(HIDE_BANNERS_JS):
                    logger.debug("Hid a cookie banner for the screenshot")
            except Exception:
                pass
            size = await page.evaluate(
                "({w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight})"
            )
            width = int(size["w"]) or 1920
            height = max(1, min(int(size["h"]), SCREENSHOT_MAX_HEIGHT))
            jpeg = await page.screenshot(
                type="jpeg",
                quality=SCREENSHOT_QUALITY,
                full_page=True,
                clip={"x": 0, "y": 0, "width": width, "height": height},
            )
            try:
                layout = await page.evaluate(LAYOUT_JS, height)
            except Exception as e:  # highlights are optional
                logger.warning("Page layout capture failed: %s", e)
                layout = None
            return {"jpeg": jpeg, "width": width, "height": height, "layout": layout}
        except Exception as e:  # a missing screenshot must never fail the scrape
            logger.warning("Screenshot failed: %s", e)
            return None

    async def fetch(
        self,
        url: str,
        scroll: bool = True,
        max_scrolls: int = 5,
        scroll_delay_ms: int = 800,
        timeout_ms: int = 30_000,
        screenshot: bool = False,
    ) -> str:
        """Fetch a URL and return the full rendered DOM HTML with stealth and dynamic scrolling.

        Steps:
        1. Opens an evasive browser context with realistic Chrome 124 headers and desktop viewport.
        2. Injects stealth scripts to prevent bot fingerprinting.
        3. Navigates with resilient fallback: waits for `domcontentloaded`, then attempts
           `networkidle` with a graceful grace period.
        4. Dismisses cookie/consent popups.
        5. Dynamically scrolls down the page if `scroll=True` to trigger infinite-scroll/lazy loading.
        6. Returns the full rendered HTML.

        Args:
            url: The target URL to fetch.
            scroll: If True, dynamically scrolls the page down to hydrate lazy elements.
            max_scrolls: Number of dynamic scroll steps (default 5).
            scroll_delay_ms: Milliseconds to pause between scroll increments (default 800).
            timeout_ms: Maximum navigation timeout in milliseconds (default 30,000).
            screenshot: Also capture the top of the rendered page as a JPEG
                into :attr:`last_screenshot` (for showing it in the UI).

        Returns:
            The rendered HTML content as a string.

        Raises:
            RuntimeError: If Navigator was not initialized via async context manager.
        """
        if self._browser is None:
            raise RuntimeError("Navigator must be used as an async context manager.")

        context: BrowserContext = await self._browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            is_mobile=False,
            has_touch=False,
            locale="en-US",
            timezone_id="Asia/Kolkata",
            java_script_enabled=True,
        )

        # Inject stealth scripts before any page script executes
        await context.add_init_script(STEALTH_INIT_SCRIPT)
        page: Page = await context.new_page()

        try:
            # Resilient navigation: wait for domcontentloaded first, then try networkidle
            network_idle = False
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                # Give a short window for network to settle without hanging forever on background websockets
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                    network_idle = True
                except Exception:
                    pass
            except PlaywrightTimeoutError:
                logger.warning("domcontentloaded timed out for %s; attempting to read partial DOM", url)

            # Allow single-page application hydration (e.g. Next.js / React splash screens)
            await page.wait_for_timeout(SETTLE_MS_AFTER_IDLE if network_idle else SETTLE_MS_STILL_BUSY)

            # Auto-dismiss cookie dialogs
            await self._dismiss_cookie_banner(page)

            # Execute dynamic scrolling if requested
            if scroll and max_scrolls > 0:
                await self._scroll_page(page, steps=max_scrolls, delay_ms=scroll_delay_ms)
                # Some banners (Naukri's) only appear after a few seconds or on scroll.
                await self._dismiss_cookie_banner(page)

            html: str = await page.content()
            self.last_screenshot = await self._screenshot(page) if screenshot else None
        finally:
            await context.close()

        return html

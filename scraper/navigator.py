"""
navigator.py
~~~~~~~~~~~~
Playwright-based async browser navigator with anti-bot stealth evasion,
cookie-banner auto-dismissal, and dynamic infinite-scroll / lazy-loading support.
"""

import logging
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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
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

    def __init__(self) -> None:
        self._playwright = None
        self._browser: Browser | None = None

    async def __aenter__(self) -> "Navigator":
        """Start the Playwright engine and launch a stealth headless Chromium browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=CHROMIUM_LAUNCH_ARGS,
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Shut down the browser and Playwright engine."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def _dismiss_cookie_banner(self, page: Page) -> None:
        """Attempt to click common cookie-consent buttons without interrupting flow."""
        for text in COOKIE_TEXTS:
            try:
                await page.get_by_text(text, exact=True).first.click(timeout=1500)
                logger.debug("Dismissed cookie banner with text: '%s'", text)
                return
            except Exception:
                pass
            try:
                locator = page.get_by_role("button", name=text)
                await locator.first.click(timeout=1500)
                logger.debug("Dismissed cookie banner button role: '%s'", text)
                return
            except Exception:
                pass

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

    async def fetch(
        self,
        url: str,
        scroll: bool = True,
        max_scrolls: int = 5,
        scroll_delay_ms: int = 800,
        timeout_ms: int = 30_000,
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
            extra_http_headers=DEFAULT_HEADERS,
            java_script_enabled=True,
        )

        # Inject stealth scripts before any page script executes
        await context.add_init_script(STEALTH_INIT_SCRIPT)
        page: Page = await context.new_page()

        try:
            # Resilient navigation: wait for domcontentloaded first, then try networkidle
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                # Give a short window for network to settle without hanging forever on background websockets
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass
            except PlaywrightTimeoutError:
                logger.warning("domcontentloaded timed out for %s; attempting to read partial DOM", url)

            # Auto-dismiss cookie dialogs
            await self._dismiss_cookie_banner(page)

            # Execute dynamic scrolling if requested
            if scroll and max_scrolls > 0:
                await self._scroll_page(page, steps=max_scrolls, delay_ms=scroll_delay_ms)

            html: str = await page.content()
        finally:
            await context.close()

        return html

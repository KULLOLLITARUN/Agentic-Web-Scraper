"""
navigator.py
~~~~~~~~~~~~
Playwright-based async browser navigator with cookie-banner auto-dismissal.
"""

from playwright.async_api import async_playwright, Page, Browser, BrowserContext


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

COOKIE_TEXTS = ["Accept All", "Accept", "I Agree", "Got it"]


class Navigator:
    """Async context manager that drives a headless Chromium browser via Playwright.

    Usage::

        async with Navigator() as nav:
            html = await nav.fetch("https://example.com")
    """

    def __init__(self) -> None:
        self._playwright = None
        self._browser: Browser | None = None

    async def __aenter__(self) -> "Navigator":
        """Start the Playwright engine and launch a headless Chromium browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=True)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Shut down the browser and Playwright engine."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def _dismiss_cookie_banner(self, page: Page) -> None:
        """Attempt to click common cookie-consent buttons.

        Iterates over a list of known button texts and silently swallows any
        errors so the main scraping flow is never interrupted.

        Args:
            page: The active Playwright :class:`Page` instance.
        """
        for text in COOKIE_TEXTS:
            try:
                await page.get_by_text(text, exact=True).first.click(timeout=2000)
                return  # dismissed — stop trying
            except Exception:
                pass
            # also try case-insensitive partial match as fallback
            try:
                locator = page.get_by_role("button", name=text)
                await locator.first.click(timeout=2000)
                return
            except Exception:
                pass

    async def fetch(self, url: str) -> str:
        """Fetch a URL and return the full page HTML after JavaScript execution.

        Steps:
        1. Opens a new browser context with a realistic user-agent.
        2. Navigates to *url*, waiting until network activity has settled
           (``networkidle``).
        3. Attempts to dismiss common cookie / consent banners.
        4. Returns the full rendered HTML as a string.

        Args:
            url: The fully-qualified URL to fetch.

        Returns:
            The rendered HTML source of the page as a :class:`str`.

        Raises:
            RuntimeError: If the browser has not been started via ``__aenter__``.
        """
        if self._browser is None:
            raise RuntimeError(
                "Navigator must be used as an async context manager."
            )

        context: BrowserContext = await self._browser.new_context(
            user_agent=USER_AGENT,
            java_script_enabled=True,
        )
        page: Page = await context.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=30_000)
            await self._dismiss_cookie_banner(page)
            html: str = await page.content()
        finally:
            await context.close()

        return html

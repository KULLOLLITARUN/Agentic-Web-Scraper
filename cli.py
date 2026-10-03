"""
Rich CLI entrypoint for the AI Web Scraper.

Usage
-----
    python cli.py <url> --schema "<description>" [options]

Examples
--------
    python cli.py https://quotes.toscrape.com \\
        --schema "Extract all quotes with text, author, and tags" \\
        --retries 3 \\
        --output quotes.json
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time

from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import print as rprint
from rich.rule import Rule
from rich.syntax import Syntax
from rich.table import Table

# ---------------------------------------------------------------------------
# Ensure the project root is on sys.path so `scraper` is importable even when
# this file is run directly (python cli.py …).
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.pipeline import ScraperPipeline  # noqa: E402

console = Console()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def print_banner() -> None:
    """Print the application banner using a Rich Panel."""
    console.print(
        Panel(
            "[bold]AI Web Scraper v1.0.0[/bold]\n"
            "[dim]Adaptive • Self-Healing • AI-Powered[/dim]",
            style="bold blue",
            title="[yellow]⚡ AI Scraper[/yellow]",
        )
    )


# ---------------------------------------------------------------------------
# Core async scrape runner
# ---------------------------------------------------------------------------
async def run_scrape(
    url: str,
    schema: str,
    max_retries: int,
    output_file: str | None,
    expect_list: bool,
) -> None:
    """
    Execute the AI scraping pipeline and display results via Rich output.

    Parameters
    ----------
    url : str
        The target URL to scrape.
    schema : str
        Plain-English description of the data schema to extract.
    max_retries : int
        Maximum number of self-healing retry attempts.
    output_file : str | None
        If provided, the extracted JSON data will be written to this path.
    expect_list : bool
        Whether the extracted result is expected to be a list of items.
    """
    print_banner()
    console.print(Rule("Starting Extraction Pipeline"))

    # Display configuration summary
    info_table = Table.grid(padding=(0, 2))
    info_table.add_column(style="bold cyan", justify="right")
    info_table.add_column(style="white")
    info_table.add_row("URL:", url)
    info_table.add_row(
        "Schema:",
        schema[:100] + "…" if len(schema) > 100 else schema,
    )
    info_table.add_row("Max retries:", str(max_retries))
    info_table.add_row("Expect list:", str(expect_list))
    console.print(info_table)
    console.print()

    start = time.time()

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
            transient=True,
        ) as progress:
            progress.add_task("Running AI extraction pipeline...", total=None)
            result = await ScraperPipeline(max_retries=max_retries).run(
                url, schema, expect_list=expect_list
            )

        elapsed = round(time.time() - start, 2)

        console.print(Rule("Results"))

        # Summary panel
        summary_table = Table.grid(padding=(0, 2))
        summary_table.add_column(style="bold green", justify="right")
        summary_table.add_column(style="white")
        summary_table.add_row("Items extracted:", str(result["items_count"]))
        summary_table.add_row("Elapsed time:", f"{elapsed}s")
        console.print(
            Panel(
                summary_table,
                title="[bold green]✓ Extraction Complete[/bold green]",
                border_style="green",
            )
        )
        for warning in result.get("warnings", []):
            console.print(f"[bold yellow]⚠[/bold yellow] {warning}")

        # JSON output
        console.print()
        console.print("[bold]Extracted Data:[/bold]")
        syntax = Syntax(
            json.dumps(result["data"], indent=2),
            "json",
            theme="monokai",
            line_numbers=False,
        )
        console.print(syntax)

        # Optional file output
        if output_file:
            with open(output_file, "w", encoding="utf-8") as fh:
                fh.write(json.dumps(result["data"], indent=2))
            console.print(
                f"\n[bold green]✓[/bold green] Data saved to [cyan]{output_file}[/cyan]"
            )

    except Exception as exc:  # noqa: BLE001
        console.print(f"\n[bold red]✗ Error:[/bold red] {exc}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    """
    Parse CLI arguments and launch the async scraping pipeline.

    This is the primary entrypoint when the script is run directly or via the
    installed console script.
    """
    parser = argparse.ArgumentParser(
        description="AI Web Scraper - Adaptive, self-healing data extraction",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python cli.py https://quotes.toscrape.com \\\n"
            '    --schema "Extract all quotes with text, author, and tags"\n\n'
            "  python cli.py https://books.toscrape.com \\\n"
            '    --schema "Extract book titles, prices, and ratings" \\\n'
            "    --output books.json"
        ),
    )

    parser.add_argument(
        "url",
        help="Target URL to scrape.",
    )
    parser.add_argument(
        "--schema",
        "-s",
        required=True,
        metavar="DESCRIPTION",
        help="Plain-English description of what data to extract.",
    )
    parser.add_argument(
        "--retries",
        "-r",
        default=3,
        type=int,
        metavar="N",
        help="Max self-healing retry attempts (default: 3).",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        metavar="FILE",
        help="Optional output JSON file path.",
    )
    parser.add_argument(
        "--no-list",
        action="store_true",
        help="Set if the result is not expected to be a list.",
    )
    parser.add_argument(
        "--log-level",
        default="WARNING",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity (default: WARNING).",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    )

    asyncio.run(
        run_scrape(
            url=args.url,
            schema=args.schema,
            max_retries=args.retries,
            output_file=args.output,
            expect_list=not args.no_list,
        )
    )


if __name__ == "__main__":
    main()

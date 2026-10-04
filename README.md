# Markpull

<div align="center">

**Markpull Scraper: point it at a web page, say what you want in plain words, get clean structured data back.**

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33?style=flat&logo=playwright&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Tests](https://img.shields.io/badge/tests-170%20passing-2EAD33?style=flat)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)

[The name](#the-name) •
[What it does](#what-it-does) •
[How it works](#how-it-works) •
[Quick start](#quick-start) •
[API](#rest-api) •
[Limits](#known-limits)

</div>

---

## The name

**Markpull** = **mark** + **pull**, the two things the app does with every page:

1. **Mark.** While it reads a page, Markpull shows you a picture of that page and *marks* each record it found with a highlighter stroke, numbered No. 01, No. 02… so you can see exactly where every row of your data came from.
2. **Pull.** It *pulls* those records out as clean, typed data: cards, a table, JSON, CSV or Excel.

The highlighter is the whole visual identity: the logo's "Mark" sits on a yellow stroke, and the same stroke is drawn over each record on the page.

Written as one word with a capital M: **Markpull** (said "mark-pull"). In page titles and search listings it carries a plain description: *Markpull Scraper* or *Markpull, AI web scraper*.

---

## What it does

Type a sentence: **From** `books.toscrape.com` **get** `every book with its title, price, star rating and stock`, and press Run.

- **Plain words or exact fields.** Describe what you want, or define typed fields (`price (number)`, `in_stock (yes/no)`, `tags (list)`). Typed values are checked, and wrong ones are asked for again.
- **See where each record came from.** A screenshot of the page with every record marked and numbered. Hover or click a record to jump to it on the page; records that couldn't be placed say so.
- **Open the real item.** Each record gets an *open ↗* link to its own page (the product, story or listing), taken from the page itself, not guessed by the model.
- **Pages that move.** JavaScript-heavy sites are rendered in Chromium; the page is scrolled for lazy content, cookie banners are dismissed, and *Load more* / *Show more* buttons are pressed (up to 3 times by default).
- **Many pages.** Follow "next page" links for up to 10 pages and get one combined list.
- **Long pages.** Long text is read in overlapping parts and merged. If the model stops before the end of a list (it can skip a run of look-alike items), the rest of the page is read again.
- **Work with the results.** Filter and sort any field; export CSV, Excel (.xlsx) or JSON. Exports follow the filter and sort.
- **Come back to it.** Run history (last 25 runs) and saved requests you can run again in one click, both kept in your browser.
- **Honest about gaps.** Notes say when text was cut off, the model's reply hit its length limit, a backup model answered, or a page came back with far fewer records than the others.

It works on any kind of list: products, stories, quotes, listings, tables, search results.

---

## How it works

```
 URL + "what to get"
        │
        ▼
 1. Navigator   Playwright Chromium: render, dismiss cookie banners, scroll,
                press "Load more", screenshot + element layout
        │
        ▼
 2. Distiller   HTML → plain text (scripts, nav, footers, SVG removed;
                links kept only when you ask for them)
        │
        ▼
 3. Brain       LLM extraction to JSON; long pages in overlapping parts;
                rest-of-page read when the list was cut short
        │
        ▼
 4. Validator   parse / repair JSON, check typed fields; on failure the exact
                problems go back to the model (up to 3 attempts)
        │
        ▼
 5. Locate      match each record to a repeated block on the page (3+
                same-width siblings) for its mark and its open ↗ link
        │
        ▼
 results + marks, streamed to the UI as they happen
```

The model provider sits behind one module (`scraper/brain.py`). Today it's Groq (`openai/gpt-oss-120b`, with smaller backups); a short per-minute rate limit is waited out on the main model, and only longer limits fall back.

---

## Quick start

**Needs:** Python 3.10+ (tested on 3.12), Node.js 18+, a free [Groq API key](https://console.groq.com/keys).

```bash
git clone https://github.com/KULLOLLITARUN/Agentic-Web-Scraper.git
cd Agentic-Web-Scraper

pip install -r requirements.txt
playwright install chromium

cd frontend && npm install && cd ..
cp .env.example .env      # then put your key in GROQ_API_KEY
```

On Windows, run `start.bat`. It opens two windows:

- **Backend:** `http://127.0.0.1:8001` (API docs at `/docs`)
- **App:** `http://localhost:5173`

Port 8001 is used so the backend doesn't clash with other local apps on 8000. The API accepts browser requests from `localhost` / `127.0.0.1` on any port; to host the app elsewhere, list its address in `.env` as `CORS_ORIGINS=https://your-site.example`.

Run the tests with `py -m pytest -q`.

---

## REST API

```bash
curl -X POST "http://127.0.0.1:8001/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://quotes.toscrape.com",
    "schema_description": "Each quote: text (string), author (string), tags (list of strings)"
  }'
```

```json
{
  "success": true,
  "url": "https://quotes.toscrape.com",
  "items_count": 10,
  "data": [
    { "text": "The world as we have created it is a process of our thinking…", "author": "Albert Einstein", "tags": ["change", "deep-thoughts", "thinking", "world"] }
  ],
  "elapsed_seconds": 4.1,
  "pages_scraped": 1,
  "error": null,
  "warnings": []
}
```

Optional fields:

| Field | Default | What it does |
|---|---|---|
| `expect_list` | `true` | `false` for one record |
| `max_pages` | `1` | follow "next page" links, up to 10 |
| `scroll` / `max_scrolls` | `true` / `5` | scroll for lazy-loaded content |
| `load_more` | `3` | press a "Load more" button up to N times (0 = never) |
| `max_retries` | `3` | attempts when typed fields don't match |
| `max_chars` | `40000` | page text read in total (long pages go in parts) |
| `headless` | `true` | `false` shows the browser window |
| `api_key` | from `.env` | use another key for this request |

**Streaming.** `POST /scrape/stream` takes the same body and returns one JSON event per line as the run goes: `step`, `retry`, `part_done`, `loaded_more`, `page_done`, `warning`, `screenshot`, `highlights`, then `result` or `error`. The app is built on this. Closing the connection stops the run.

**CLI.**

```bash
python cli.py https://quotes.toscrape.com -s "Each quote: text (string), author (string)" --pages 10 -o quotes.json
```

---

## Checked on real sites

| Site | Kind of page | Result |
|---|---|---|
| Books to Scrape | product grid | 20 of 20 books; each marked on the page with its own book link |
| Hacker News | ranked list | 30 of 30 stories; every *open ↗* matches the story's link |
| Quotes to Scrape | static list | 10 quotes with tags |
| scrapingcourse.com (button page) | "Load more" list | 48 products after 3 presses (12 without) |
| Naukri job search | JavaScript app with cookie banners | full page of jobs; marks on each job card |

---

## Known limits

- **Free model quota.** The free Groq tier allows about 200k tokens a day for the main model, roughly 20 long pages. After that a smaller backup answers and finds fewer items; the app says "backup model used" when that happens.
- **History has no pictures.** Past runs reopen with their data, not the page screenshot.
- **Kept per browser.** History and saved requests live in the browser you used.
- **Sites that block bots** may need "show browser window" (advanced) or may not work at all.

---

## Responsible use

Only scrape sites you're allowed to. Respect each site's terms, `robots.txt` and rate limits, and don't collect personal data without a lawful basis.

---

## License

MIT. See `LICENSE`.

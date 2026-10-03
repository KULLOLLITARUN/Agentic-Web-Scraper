# Agentic Web Scraper // Precision Instrument Workbench

<div align="center">

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Headless-2EAD33?style=flat&logo=playwright&logoColor=white)
![Groq](https://img.shields.io/badge/Groq%20LPU-Qwen%2027B-F55036?style=flat)
![Pydantic](https://img.shields.io/badge/Pydantic-2.0-E92063?style=flat&logo=pydantic&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)

**An autonomous, self-healing web extraction system powered by Playwright, Groq LPUs, and Pydantic validation.**  
*Extract structured data from modern dynamic React SPAs and static websites using plain English. Zero CSS selectors required.*

[Architecture](#-core-architecture) •
[Features](#-key-innovations) •
[Quick Start](#-quick-start) •
[Workbench UI](#-precision-instrument-workbench) •
[Live Benchmarks](#-live-verification-benchmarks) •
[Roadmap](#-enterprise-roadmap-1000-pages)

</div>

---

## 🛑 The Traditional Web Scraping Problem

Traditional scrapers (Scrapy, BeautifulSoup, Selenium, Puppeteer) rely on **rigid CSS selectors and brittle XPath expressions**:

```python
# Fragile legacy code:
price = soup.select_one("div.product-card > div._34h7-bold > span.price-value").text
```

The moment a website updates its UI design, introduces dynamic obfuscated class names (`styles_splScrn__C8kSD`), or migrates to a client-side Single Page App (React/Next.js), **traditional scrapers break completely**. Engineers spend countless hours writing and maintaining brittle selectors.

---

## 💡 The Agentic Solution

This system replaces rigid selectors with **visual and semantic reasoning**:
1. You describe the data you want in **plain English** (e.g., *"Each job: title, company, salary, experience, skills"*).
2. The headless browser renders the page, executes client-side JavaScript, and dynamically scrolls to hydrate lazy elements.
3. An **HTML Distillation Engine** compresses the DOM by **85–97%** in under 8ms.
4. An **autonomous Groq LPU LLM (`qwen/qwen3.8-27b`)** identifies entities by semantic context rather than class names.
5. A deterministic **Pydantic Self-Healing Validator** audits the output. If a schema drift or type clash occurs, it automatically feeds the validation diff back to the LLM to self-correct in real time.

---

## 🏗️ Core Architecture

```
┌─────────────────────┐
│ 1. BROWSER NAVIGATOR│  Playwright (Chrome Channel)
│  (Headless Engine)  │  • Full client-side JavaScript rendering
└──────────┬──────────┘  • Dynamic auto-scroll & lazy-load hydration
           │ Rendered DOM
           ▼
┌─────────────────────┐
│ 2. HTML DISTILLER   │  BeautifulSoup + LXML
│  (Token Optimizer)  │  • Strips 12+ noisy structural tags (<svg>, <nav>, etc.)
└──────────┬──────────┘  • 85–97% payload reduction in <8ms
           │ Cleaned Semantic Text
           ▼
┌─────────────────────┐
│ 3. COGNITIVE BRAIN  │  Groq LPUs (qwen/qwen3.8-27b)
│    (LLM Parser)     │  • Zero CSS selectors; plain English mapping
└──────────┬──────────┘  • Entity disambiguation & array extraction
           │ Extracted JSON
           ▼
┌─────────────────────┐
│ 4. SELF-HEALING     │  Deterministic Pydantic Engine
│      VALIDATOR      │  • Enforces schema, types, & non-empty payloads
└──────────┬──────────┘
           │
           ├── Passed? ────────► [ Deliver Clean Data to UI / API ]
           │
           └── Failed? ────────► [ Autonomous Feedback Loop ]
                                 "Item 2: expected float, got string. Fix and retry."
                                 (Re-invokes Brain up to max_retries)
```

---

## ✨ Key Innovations

### 1. Zero CSS Selectors
Never inspect element trees or copy XPaths again. Define your target data schema conversationally:
```text
Each job: title (string), company (string), salary (string), location (string), skills (list of strings)
```

### 2. High-Ratio HTML Distillation Engine
Sending 500KB of raw HTML (SVGs, inline styles, navigation links, tracking scripts) directly to an LLM exhausts token budgets and spikes latency. The built-in Distiller cleans the DOM down to essential content, cutting payload sizes by up to **97%** and reducing Groq inference time to **1–2 seconds**.

### 3. Agentic Self-Healing Loop
Unlike brittle scripts that throw exceptions when a site changes, the pipeline implements an autonomous feedback loop:
* **Layer 1:** Strips markdown tags and AI chain-of-thought `<think>` blocks.
* **Layer 2:** Validates root array structural integrity.
* **Layer 3:** Discards ghost / empty hallucinations.
* **Layer 4:** Enforces strict Pydantic type specifications. If an error occurs, it formats the exact diff and re-prompts the model until valid.

### 4. Headless Rendering for Modern SPAs
* Runs fully headless, rendering client-side JavaScript before extraction.
* Avoids global `Accept` header conflicts, preserving background client-side AJAX/JSON calls for modern React, Vue, and Next.js applications.

---

## 📊 Live Verification Benchmarks

| Target Website | Page Complexity | Natural Language Schema | Verification Result |
| :--- | :--- | :--- | :--- |
| **Quotes to Scrape** | Static Server HTML | *"Each quote: text, author, tags"* | ✅ **10 quotes**, 0 retries, 85% compression |
| **Apple Inc.** | Enterprise E-Commerce | *"Find all phones, slogans, and prices"* | ✅ **6 models extracted** with Indian Rupee (`₹`) prices |
| **Y Combinator** | Real-time Job Directory | *"Find AI roles: company, title"* | ✅ **30 jobs extracted** in a single pass |

---

## 🖥️ Precision Instrument Workbench

The system includes a dark industrial desktop workbench built with **React 18, Vite, and Tailwind CSS**:

* **Control Deck:** Target URL input, conversational schema editor with line numbering, retries slider, auto-scroll depth selector, and browser mode switch.
* **Real-time Pipeline Tracker:** Visual stepper monitoring `FETCH` → `DISTILL` → `INFER` → `VALIDATE` phases.
* **Dual Output Inspector:** Switch seamlessly between raw validated JSON and interactive data table views.
* **Live Telemetry:** Tracks DOM reduction ratios, elapsed wall-clock latency, and self-healing log events.
* **Export Options:** Download results as formatted JSON or standard CSV.

---

## 🚀 Quick Start

### 1. Prerequisites
* **Python 3.10+** (Tested on Python 3.12)
* **Node.js 18+** (For frontend workbench)
* **Google Chrome** installed locally

### 2. Clone & Setup

```bash
git clone https://github.com/KULLOLLITARUN/Agentic-Web-Scraper.git
cd Agentic-Web-Scraper

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browser binaries
playwright install chromium
```

### 3. Configure API Key
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Add your free Groq API key:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b
```

### 4. Launch Workbench (One-Click)

On Windows, double-click or run:
```cmd
start.bat
```
This automatically starts:
* **FastAPI Backend:** `http://127.0.0.1:8000` (API Docs: `http://127.0.0.1:8000/docs`)
* **Vite React UI:** `http://localhost:5173`

---

## 📡 REST API Usage

Trigger the scraper directly via `cURL` or any HTTP client:

```bash
curl -X POST "http://127.0.0.1:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://quotes.toscrape.com",
    "schema_description": "Each quote: text (string), author (string), tags (list of strings)",
    "max_retries": 3,
    "expect_list": true,
    "scroll": true,
    "max_scrolls": 5,
    "headless": true
  }'
```

### Response Example:
```json
{
  "success": true,
  "url": "https://quotes.toscrape.com",
  "items_count": 10,
  "data": [
    {
      "text": "The world as we have created it is a process of our thinking...",
      "author": "Albert Einstein",
      "tags": ["change", "deep-thoughts", "thinking", "world"]
    }
  ],
  "elapsed_seconds": 1.48,
  "error": null,
  "warnings": []
}
```

`warnings` lists reasons the data may be incomplete, e.g. the page text was longer than `max_chars` or the model's output was cut off. Optional request fields: `model` (preferred Groq model), `api_key` (overrides `GROQ_API_KEY`) and `max_chars` (page text limit, default 12,000).

### Streaming progress

`POST /scrape/stream` takes the same body and returns newline-delimited JSON, one event per line, as the pipeline runs. The Workbench uses this to drive its progress tracker.

```bash
curl -N -X POST "http://127.0.0.1:8000/scrape/stream" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://quotes.toscrape.com", "schema_description": "Each quote: text (string), author (string)"}'
```

```json
{"type": "step", "step": "fetch"}
{"type": "step", "step": "distill", "html_chars": 10968}
{"type": "step", "step": "infer", "text_chars": 1629, "attempt": 1, "max_attempts": 3}
{"type": "step", "step": "validate", "attempt": 1, "max_attempts": 3}
{"type": "step", "step": "done"}
{"type": "result", "success": true, "items_count": 10, "data": [...], "warnings": [], ...}
```

A failed validation emits `{"type": "retry", "attempt": 1, "error": "..."}` before the next attempt. A failed scrape ends with `{"type": "error", "step": "fetch", "message": "..."}`. Closing the connection cancels the scrape.

---

## 🗺️ Enterprise Roadmap (1,000+ Pages)

For high-scale scraping across thousands of pages, the system architecture supports the following extensions:

1. **Distributed Asynchronous Workers:** Decouple crawling from web sockets using Celery / Redis task queues.
2. **Chunked Database Streaming:** Stream records directly into PostgreSQL / SQLite per page to guarantee zero data loss.
3. **Hybrid Extraction Engine:** Use Groq LLM on Page 1 to infer layout structure, then switch to compiled pure-Python extractors for Pages 2–1,000 (**99% token cost reduction at 0.01s/page**).

---

## ⚖️ Responsible Use

Only scrape sites you are permitted to access. Respect each site's terms of service, `robots.txt` and rate limits, and do not use this tool to collect personal data without a lawful basis.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

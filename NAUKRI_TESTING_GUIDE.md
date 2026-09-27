# Naukri Live Extraction & Testing Guide

This document records the exact live verification tests, prompt schemas, technical root causes, and verification results for scraping dynamic single-page applications (SPAs) like **Naukri.com** using the AI Web Scraper.

---

## 1. Target URL

```text
https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB
```

---

## 2. Tested Prompt Schemas

### Prompt 1: Standard Job Card Schema (Recommended)
Use this schema for fast, lightweight extraction of key job card attributes:

```text
Each job: title (string), company (string), experience (string), salary (string), location (string), skills (list of strings)
```

### Prompt 2: Comprehensive Job Schema (Detailed Attributes)
Use this schema when you need deeper metadata, company ratings, and posting recency:

```text
Each job listing:
- title: designation or job title (string)
- company: company or consultancy name (string)
- rating: company star rating out of 5 (float or null)
- experience: required years of experience (string)
- salary: offered package or "Not disclosed" (string)
- location: primary city or hybrid status (string)
- skills: list of technical skills and tech stack tags (list of strings)
- posted: posting date or time, e.g. "Just now", "2 days ago" (string)
```

---

## 3. Experimental Diagnostic Journey

During testing, we encountered and diagnosed two distinct real-world web defense and SPA challenges:

### Phase 1: Akamai WAF Block & Self-Healing Reaction
* **Symptom:** The scraper returned `All extracted items were empty. The AI found no data.`
* **Diagnostic:** Raw HTML was only 325 characters. Naukri's **Akamai EdgeSuite Bot Manager** flagged standard Playwright Chromium and served a 403 `Access Denied` error.
* **Agentic Behavior:** Because the page literally contained zero jobs, the Groq AI returned `[]`. Rather than hallucinating fake jobs, the **Self-Healing Validator** caught the empty payload and protected data integrity.

### Phase 2: The Blank White Screen (`<body></body>` Empty)
* **Symptom:** When visible Chrome launched, the window opened but stayed completely blank white (1,450 bytes HTML).
* **Isolation Test Results:** We ran an A/B matrix isolating each browser flag:
  1. *Clean Chrome:* 402,490 characters (Loaded OK)
  2. *With Launch Args:* 397,160 characters (Loaded OK)
  3. *With Stealth Script:* 397,901 characters (Loaded OK)
  4. *With Custom Headers (`Accept: text/html`):* **1,450 characters (CRASHED: `<body></body>` empty)**
  5. *With Custom User-Agent:* 400,319 characters (Loaded OK)
* **Root Cause:** Naukri is a client-side React app. Injecting `Accept: text/html` globally forced background AJAX JSON requests to ask for HTML. Naukri's backend rejected the API calls, causing the React app to crash before mounting.
* **The Fix:** Removed the forced global `Accept` header and allowed native content negotiation.

### Phase 3: Headless Chrome Channel Evasion
* By binding Playwright to the installed Chrome engine (`channel="chrome"`, `headless=True`) with anti-automation flags, **Headless Mode worked 100% silently in the background**.
* Raw DOM expanded from 325 bytes to **399,782 characters** (12,015 characters distilled).

---

## 4. Live Verification Results

* **Extraction Mode:** `100% HEADLESS (INVISIBLE)`
* **HTTP Status:** `200 OK`
* **Raw HTML Size:** `399,782 characters`
* **Distilled Payload:** `12,015 characters` (97% reduction)
* **Total Jobs Extracted:** **22 live jobs in a single pass**

### Sample Extracted Payload

```json
[
  {
    "title": "AI/ML Engineer",
    "company": "A One Softs",
    "experience": "4-8 Yrs",
    "salary": "Not disclosed",
    "location": "Bengaluru",
    "skills": [
      "mlops",
      "python",
      "nlp",
      "generative ai",
      "computer vision",
      "ai",
      "model deployment",
      "machine learning"
    ]
  },
  {
    "title": "AI/ML Engineer",
    "company": "Convate Consultancy Services",
    "experience": "5-10 Yrs",
    "salary": "Not disclosed",
    "location": "Bengaluru",
    "skills": [
      "AI Engineer",
      "ML Engineer",
      "AI/ML Engineer",
      "Data Scientist",
      "Artificial Intelligence",
      "Machine Learning Engineer",
      "Machine Learning",
      "Deep Learning"
    ]
  }
]
```

---

## 5. How to Replicate This Test

### Via Workbench UI (`http://localhost:5173`)
1. Double-click `start.bat` to ensure services are live.
2. In the UI, set:
   * **Target URL:** `https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB`
   * **Schema:** Paste **Prompt 1** or **Prompt 2** from above.
   * **Browser Mode:** `● HEADLESS (INVISIBLE)`
   * **Auto-Scroll:** `ON` (Depth: `5x`)
   * **Expect Array:** `ON`
3. Click **RUN EXTRACTION** (`Ctrl + Enter`).

### Via cURL / API
```bash
curl -X POST "http://127.0.0.1:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB",
    "schema_description": "Each job: title (string), company (string), experience (string), salary (string), location (string), skills (list of strings)",
    "max_retries": 3,
    "expect_list": true,
    "scroll": true,
    "max_scrolls": 5,
    "headless": true
  }'
```

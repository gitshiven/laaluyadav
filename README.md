# 🧔 Laaluyadav — Unemployable Unc


Desi uncle certified movie & TV recommendations. Community sentiment. No filmy nonsense.

---

## What is this?

Laaluyadav is a movie and TV show recommendation engine that goes beyond IMDB scores and critic reviews. It reads real audience conversations, extracts emotional signals, and ranks films by what people actually *felt* — not what critics wrote.

---

## Screenshots

### Search Interface
![Search Interface](https://raw.githubusercontent.com/gitshiven/laaluyadav/main/docs/search.png)

### Ask Laalu Chat
![Ask Laalu](https://raw.githubusercontent.com/gitshiven/laaluyadav/main/docs/chat.png)

---

## What makes it different from Google?

| Feature | Google/IMDB | Laaluyadav |
|---|---|---|
| Scores | Critic + general public | Audience sentiment weighted |
| Language | English only | Hindi, Hinglish, English |
| Context | None | "khaate hue", "2 baje akele", "date night" |
| Emotional DNA | ✗ | ✓ — "Broke me at 2am", "Rewatch changes everything" |
| Rewatch Index | ✗ | ✓ — how often people rewatch |
| Regret Score | ✗ | ✓ — "wish I found this sooner" |
| Laalu Dissent | ✗ | ✓ — flags overhyped & underseen films |
| Gateway | ✗ | ✓ — rabbit holes each film opens |
| Why This | ✗ | ✓ — why THIS film for YOUR specific query |
| Ask Anything | ✗ | ✓ — chat in any language |

---

## Scoring System

**Final Score:**
- Community Sentiment (audience discussions) × 35%
- IMDB Rating (via OMDB API) × 25%
- RT Audience Score (via OMDB API) × 25%
- Rewatch Index (discussion signals) × 15%

**Community score formula:**
- Base = (positive mentions × 2.0) + (neutral × 0.5) - (negative × 1.5)
- Boost = upvotes > 500 → +1.0 | comment thread > 50 → +0.5
- Penalty = "overrated"/"disappointed"/"fell asleep" → -1.5 each

---

## Features

- 🎬 **Movies + TV Shows** — separate community pools for each
- 🌍 **World cinema** — any language, any era
- 🗣️ **Hinglish support** — ask in Hindi, Hinglish, or English
- 🎯 **Why This** — Laalu explains why each pick matches your exact query
- ◈ **Emotional DNA** — how the film actually feels
- ✓/✗ **Who Is This For** — watch/skip profiles
- 🔁 **Rewatch Index** — rewatchability score out of 10
- 😬 **Regret Score** — "wish I found this sooner" signal
- 🚪 **Gateway** — rabbit hole each film/show opens
- 🚩 **Laalu Dissent** — flags when hype doesn't match reality
- ⚡ **Final Score** — weighted blend of all 4 sources
- 💬 **Ask Laalu** — streaming chat, any language, no filter
- 🔗 **Share Links** — every search is a shareable URL
- 📱 **Mobile responsive** — works on all screen sizes
- 🔒 **Rate limited** — 5 req/min, 20 req/day per IP

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Inline styles + CSS animations |
| API | Next.js Node Route |
| AI | Claude Sonnet via Anthropic API |
| Scraping | Apify trudax/reddit-scraper-lite via MCP |
| Movie data | OMDB API (IMDB + RT scores) + TMDB API (posters) |
| Deploy | Vercel |
| Extension | Chrome Manifest V3 |

---

## Local Development

### 1. Clone and install

    git clone https://github.com/gitshiven/laaluyadav.git
    cd laaluyadav
    npm install

### 2. Set up environment variables

    cp .env.example .env.local

Edit `.env.local`:

    ANTHROPIC_API_KEY=sk-ant-...
    APIFY_API_KEY=apify_api_...
    OMDB_API_KEY=your_8char_key
    TMDB_API_KEY=eyJhbGci...bearer_token

Get your keys:
- Anthropic: https://console.anthropic.com/keys
- Apify: https://console.apify.com/account/integrations
- OMDB: https://www.omdbapi.com/apikey.aspx (free, activate via email)
- TMDB: https://www.themoviedb.org/settings/api (free, instant)

### 3. Run dev server

    npm run dev

Open http://localhost:3000

---

## Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework: Next.js (auto-detected)
4. Add all 4 environment variables
5. Click Deploy

---

## Chrome Extension

1. In `extension/popup.js` line 3, update the API_URL to your Vercel URL
2. Open Chrome → chrome://extensions/
3. Enable Developer mode
4. Click Load unpacked → select the extension/ folder

---

## Rate Limits

| Window | Limit |
|---|---|
| Per minute | 5 requests |
| Per day | 20 requests |

---

## Project Structure

    laaluyadav/
    ├── app/
    │   ├── api/movies/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── Logo.tsx
    │   └── MovieCard.tsx
    ├── extension/
    │   ├── manifest.json
    │   ├── popup.html
    │   ├── popup.js
    │   └── icons/
    ├── lib/
    │   ├── types.ts
    │   └── utils.ts
    ├── public/
    │   ├── favicon.svg
    │   ├── manifest.json
    │   └── icons/
    └── .env.example

---

## Roadmap

- [ ] Search history (last 10 searches)
- [ ] Watchlist with watched/pending tracking
- [ ] Supabase auth — persistent watchlist across devices
- [ ] True streaming responses (SSE)
- [ ] Firefox extension port
- [ ] Redis caching for repeat queries

---

Built by Shiven · Dublin 🇮🇪 · [github.com/gitshiven](https://github.com/gitshiven)

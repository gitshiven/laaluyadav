# 🧔 Laaluyadav — The Movie Oracle

Desi uncle certified movie recommendations. Top 5 world cinema picks, powered by community intelligence, IMDB, and Popcornmeter.

---

## Stack

- **Frontend** — Next.js 14 (App Router) + TypeScript
- **API** — Next.js Edge Route (API key stays server-side, never in browser)
- **AI** — Claude Sonnet via Anthropic API
- **Scraping** — Apify `trudax/reddit-scraper-lite` via MCP
- **Deploy** — Vercel (free tier)
- **Extension** — Chrome Manifest V3 (calls deployed Vercel API)

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/yourusername/laaluyadav.git
cd laaluyadav
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
APIFY_API_KEY=apify_api_...
```

Get your keys:
- Anthropic: https://console.anthropic.com/keys
- Apify: https://console.apify.com/account/integrations

### 3. Run dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/yourusername/laaluyadav.git
git push -u origin main
```

### 2. Import on Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Add Environment Variables:
   - `ANTHROPIC_API_KEY` → your key
   - `APIFY_API_KEY` → your key
5. Click **Deploy**

Done. Your app is live at `https://laaluyadav.vercel.app`

---

## Chrome Extension Setup

The extension calls your **deployed** Vercel API — so deploy first.

### 1. Update the API URL

In `extension/popup.js`, line 3:
```js
const API_URL = 'https://laaluyadav.vercel.app/api/movies'
// Replace with your actual Vercel URL ↑
```

### 2. Add icons

Create `extension/icons/` folder and add:
- `icon16.png`  (16×16)
- `icon48.png`  (48×48)
- `icon128.png` (128×128)

You can use any image editor or https://favicon.io to generate from text "L".

### 3. Load in Chrome (dev mode)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

The 🧔 icon appears in your toolbar. Click it to use Laaluyadav on any page.

### 4. Publish to Chrome Web Store (optional)

1. Zip the `extension/` folder
2. Go to https://chrome.google.com/webstore/devconsole
3. Pay $5 one-time developer fee
4. Upload the zip → fill in description → submit for review
5. Review takes 1–3 days

---

## Project Structure

```
laaluyadav/
├── app/
│   ├── api/
│   │   └── movies/
│   │       └── route.ts      ← Server-side API (keys live here)
│   ├── layout.tsx
│   └── page.tsx              ← Main UI
├── components/
│   └── MovieCard.tsx
├── lib/
│   ├── types.ts
│   └── utils.ts
├── extension/
│   ├── manifest.json         ← Chrome extension config
│   ├── popup.html            ← Extension UI
│   ├── popup.js              ← Extension logic (calls Vercel API)
│   └── icons/                ← Add your icons here
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## How It Works

1. User types a mood/genre query
2. Next.js API route (server-side) calls Apify to gather community movie data
3. Claude analyses the data and extracts top 5 with scoring
4. Community Score = posts × 1.5 + comments × 1.0, normalised to 10
5. Real IMDB + Popcornmeter scores fetched per film
6. Results rendered with Laaluyadav's Hinglish verdict

**No data sources are ever exposed to the user.** Everything happens server-side.

---

## Roadmap

- [ ] "Surprise Me" button (random mood)
- [ ] Share card as image (html2canvas)
- [ ] Search history panel
- [ ] Rate limit + caching layer (Redis/Upstash)
- [ ] Firefox extension port

---

Built by Shiven · Dublin 🇮🇪

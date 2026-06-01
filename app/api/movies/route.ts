import { NextRequest, NextResponse } from 'next/server'

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const dailyMap     = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT   = { windowMs: 60 * 1000, maxReqs: 5, maxDaily: 20 }

function checkRateLimit(ip: string): { allowed: boolean; message: string } {
  const now = Date.now()
  const minute = rateLimitMap.get(ip)
  if (!minute || now > minute.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
  } else {
    minute.count++
    if (minute.count > RATE_LIMIT.maxReqs) {
      const retryIn = Math.ceil((minute.resetAt - now) / 1000)
      return { allowed: false, message: `Arrey bhai thoda ruk! ${retryIn} seconds mein try karo.` }
    }
  }
  const startOfDay = new Date().setHours(0, 0, 0, 0)
  const daily = dailyMap.get(ip)
  if (!daily || now > daily.resetAt) {
    dailyMap.set(ip, { count: 1, resetAt: startOfDay + 24 * 60 * 60 * 1000 })
  } else {
    daily.count++
    if (daily.count > RATE_LIMIT.maxDaily) {
      return { allowed: false, message: `Bhai aaj ka quota khatam. Kal aa jaana — rozana 20 queries free hain!` }
    }
  }
  return { allowed: true, message: '' }
}

setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((v, k) => { if (now > v.resetAt) rateLimitMap.delete(k) })
  dailyMap.forEach((v, k)     => { if (now > v.resetAt) dailyMap.delete(k) })
}, 10 * 60 * 1000)

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
export const runtime   = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_API    = 'https://api.anthropic.com/v1/messages'
const MODEL            = 'claude-sonnet-4-6'
const MAX_RESULTS      = 20
const MIN_RESULTS      = 1
const MAX_QUERY_LENGTH = 200

const MOVIE_SUBREDDITS = [
  'bollywood','BollywoodMemes','moviesuggestions','india','movies',
  'underratedmovies','HorrorMovies','TrueFilm','Letterboxd','horror',
  'boxoffice','IndianCinema','TeenIndia','criterion','okbuddycinephile',
  'wehatemovies','moviescirclejerk','boutiquebluray','blankies',
]
const TV_SUBREDDITS = [
  'televisionsuggestions','tvshow','community','television','TvShows',
  'sitcoms','tvPlus','Netflixwatch','hbo','BritishTV',
  'bestofnetflix','indiasocial','IndianOTTbestof','IndianTellyTalk','funnyIndia',
]
const ALL_SUBREDDITS = [...MOVIE_SUBREDDITS, ...TV_SUBREDDITS]

// ── OMDB ──────────────────────────────────────────────────────────────────────
async function fetchOMDB(title: string, year?: string) {
  try {
    const params = new URLSearchParams({
      apikey: process.env.OMDB_API_KEY!,
      t: title,
      plot: 'short',
      ...(year ? { y: year } : {}),
    })
    const res = await fetch(`http://www.omdbapi.com/?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'False') return null
    const rtRating   = data.Ratings?.find((r: { Source: string }) => r.Source === 'Rotten Tomatoes')
    const rtAudience = rtRating?.Value?.replace('%', '') || null
    console.log(`[OMDB] ${title} → IMDB: ${data.imdbRating} | RT: ${rtAudience}`)
    return {
      imdb:       data.imdbRating !== 'N/A' ? data.imdbRating : null,
      imdbVotes:  data.imdbVotes  !== 'N/A' ? data.imdbVotes  : null,
      rtAudience,
      poster:     data.Poster     !== 'N/A' ? data.Poster     : null,
      genre:      data.Genre      || null,
      runtime:    data.Runtime    || null,
      awards:     data.Awards     || null,
    }
  } catch (err) {
    console.error(`[OMDB] failed for "${title}":`, err)
    return null
  }
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
async function fetchTMDB(title: string, type: 'movie' | 'show', year?: string) {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      'Content-Type': 'application/json',
    }
    const endpoint = type === 'movie' ? 'movie' : 'tv'
    const params   = new URLSearchParams({
      query: title,
      ...(year ? { first_air_date_year: year, primary_release_year: year } : {}),
    })
    const searchRes = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?${params}`, { headers })
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const item       = searchData.results?.[0]
    if (!item) return null
    return {
      tmdbScore:  item.vote_average ? parseFloat(item.vote_average).toFixed(1) : null,
      tmdbVotes:  item.vote_count   || null,
      poster:     item.poster_path   ? `https://image.tmdb.org/t/p/w300${item.poster_path}`  : null,
      backdrop:   item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
      overview:   item.overview      || null,
    }
  } catch { return null }
}

// ── WEIGHTED FINAL SCORE ──────────────────────────────────────────────────────
function computeFinalScore({ communityScore, imdb, rtAudience, tmdbScore, rewatchIndex }: {
  communityScore: number; imdb: string | null; rtAudience: string | null
  tmdbScore: string | null; rewatchIndex: number
}): number {
  const community = communityScore || 0
  const imdbNorm  = imdb       ? (parseFloat(imdb) / 10) * 10       : community
  const rtNorm    = rtAudience ? parseFloat(rtAudience) / 10         : community
  const tmdbNorm  = tmdbScore  ? parseFloat(tmdbScore)               : community
  const rewatch   = rewatchIndex || 0
  const score     = (community * 0.35) + (imdbNorm * 0.25) + (rtNorm * 0.25) + (rewatch * 0.15)
  return Math.round(score * 10) / 10
}

// ── CLAUDE ────────────────────────────────────────────────────────────────────
async function callClaude(system: string, userMsg: string, mcpServers?: object[], maxTokens = 1000) {
  const body: Record<string, unknown> = {
    model: MODEL, max_tokens: maxTokens, system,
    messages: [{ role: 'user', content: userMsg }],
  }
  if (mcpServers) body.mcp_servers = mcpServers
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'mcp-client-2025-04-04',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Anthropic API ${res.status}: ${err}`) }
  return res.json()
}

// ── CHAT HANDLER ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed, message } = checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: message }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const question = searchParams.get('q')?.trim()
  if (!question) return NextResponse.json({ error: 'No question provided.' }, { status: 400 })
  if (question.length > 500) return NextResponse.json({ error: 'Question too long.' }, { status: 400 })

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(ANTHROPIC_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'mcp-client-2025-04-04',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 1000,
            stream: true,
            system: `You are Laaluyadav — a desi uncle who is a world cinema and television expert.
You answer ANY question about films and TV shows. Brutal honesty, Hinglish wit.
You understand English, Hindi, and Hinglish equally well.
You can answer:
- "Should I watch Season 2 of Dark?"
- "Parasite ka ending explain karo"
- "kya Interstellar overrated hai?"
- "best Scorsese film konsi hai?"
- "yaar khaate hue kuch funny batao"
Keep answers concise — max 4-5 sentences. Always end with a punchy Laalu verdict.
Never say you are an AI. You are Laaluyadav. Always.`,
            messages: [{ role: 'user', content: question }],
          }),
        })

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const data = line.replace('data: ', '').trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const text   = parsed.delta?.text || ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* skip malformed chunks */ }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode('Arre bhai, kuch gadbad ho gayi. Dobara try karo!'))
        console.error('[chat] stream error:', err)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' }
  })
}

// ── MAIN RECOMMENDATIONS HANDLER ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || 'unknown'
    const { allowed, message } = checkRateLimit(ip)
    if (!allowed) return NextResponse.json({ error: message }, { status: 429 })

    const { query, era, count, contentType } = await req.json()
    if (!query || typeof query !== 'string') return NextResponse.json({ error: 'Query is required.' }, { status: 400 })

    const cleanQuery = query.trim().slice(0, MAX_QUERY_LENGTH)
    if (cleanQuery.length < 2) return NextResponse.json({ error: 'Query too short.' }, { status: 400 })

    const blockedPatterns = [/(.)\1{15,}/, /<script/i, /javascript:/i]
    if (blockedPatterns.some(p => p.test(cleanQuery))) return NextResponse.json({ error: 'Invalid query.' }, { status: 400 })

    const resultCount = Math.min(Math.max(parseInt(count) || 5, MIN_RESULTS), MAX_RESULTS)
    const type        = ['movie', 'show', 'both'].includes(contentType) ? contentType : 'both'

    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set.' }, { status: 500 })

    const subreddits = type === 'movie' ? MOVIE_SUBREDDITS : type === 'show' ? TV_SUBREDDITS : ALL_SUBREDDITS

    // Step 1 — Scrape
    let rawData = ''
    try {
      const scrapeData = await callClaude(
        `You are a sentiment-aware media data agent. Use the apify MCP tool to call trudax/reddit-scraper-lite.
Search across: ${subreddits.join(', ')}.
Extract: movieName/showName, sentiment (positive/negative/mixed), emotionalSignals, upvoteCount, replyCount.
Return ONLY a JSON array. No markdown.`,
        `Query: "${cleanQuery} ${type === 'show' ? 'tv show series' : type === 'movie' ? 'movie film' : 'movie film tv show'} recommendations"
Era: "${era}". maxItems: 50.`,
        [{ type: 'url', url: 'https://mcp.apify.com', name: 'apify' }], 1000
      )
      rawData = scrapeData.content
        .filter((c: { type: string }) => c.type === 'text' || c.type === 'mcp_tool_result')
        .map((c: { text?: string; content?: { text: string }[] }) => c.text || c.content?.[0]?.text || '')
        .join('\n')
    } catch { rawData = '' }

    // Step 2 — Analyse
    const typeLabel = type === 'movie' ? 'films only' : type === 'show' ? 'TV shows only' : 'both films AND TV shows'

    const analysisData = await callClaude(
      `You are Laaluyadav — desi uncle, world cinema AND television expert. Brutal honesty, Hinglish wit.
Find what the AUDIENCE genuinely loved. Not critics. Not hype. Real human emotion.

CONTENT TYPE: ${typeLabel}

LANGUAGE: understand English, Hindi, Hinglish equally. Extract core intent from any phrasing:
  "yaar khaate hue kuch badhiya dekhna hai" → easy, fun, light, doesn't need full attention
  "kuch aisa jo rona aa jaye" → emotional gut-punch
  "dimag ghoomane wali" → mind-bending thriller
  "date night ke liye" → romantic, beautiful
  "2 baje akela" → dark, atmospheric, immersive
  Match recommendations to ACTUAL INTENT not just literal words.

SCORING — communityScore out of 10:
  Base    = (positive × 2.0) + (neutral × 0.5) - (negative × 1.5)
  Boost   = upvotes > 500 → +1.0 | replies > 50 → +0.5
  Penalty = "overrated"/"disappointed"/"fell asleep" → -1.5
  Normalize 0–10

rewatchIndex (0–10): "rewatched", "n-th rewatch", "can't stop"
regretScore  (0–10): "wish I found sooner", "slept on this"

EMOTIONAL DNA: 2–4 punchy tags of actual emotional experience
  Good: ["Gut-punch ending", "Broke me at 2am", "Rewatch changes everything"]
  Bad: ["Good story"] — rejected

WHO IS THIS FOR: watch/skip in one sentence each

WHY THIS FOR THIS QUERY (most important):
  "whyThisQuery": one punchy sentence explaining exactly WHY this film/show matches the user's specific request
  Examples:
  Query "khaate hue": "Khaate hue perfect — funny enough to enjoy in background, good enough to put fork down for key scenes."
  Query "anurag kashyap best": "Ye uska darkest, most personal kaam hai — baki sab iske baad samjh aayega."
  Query "mind bending": "First watch mein confuse, second watch mein sab kuch click karta hai ek saath."

LAALU DISSENT (optional): overhyped/underseen with Hinglish quote
GATEWAY (optional): specific rabbit hole this opens

VERDICT: brutal Hinglish max 12 words, from real audience feeling

ORDER: best to worst by communityScore. Ties broken by rewatchIndex.

Return ONLY valid JSON array, no markdown:
[{
  "title": "string",
  "year": "YYYY",
  "type": "Movie|TV Show|Mini-Series|Docuseries",
  "seasons": "N seasons",
  "taste": "Action Masala|Emotional Drama|Dark Comedy|Slow Burn Thriller|Romance|Horror|Arthouse|Sci-Fi|World Cinema|Feel-Good Comedy|Crime & Mystery|Docuseries|Anthology|Sitcom|Miniseries",
  "description": "2 sentences — what it IS + why audiences lose their mind",
  "whyThisQuery": "one punchy sentence — why THIS for THIS specific query",
  "communityScore": 8.6,
  "rewatchIndex": 9.1,
  "regretScore": 8.4,
  "buzzIndex": "Insane|Very High|High|Decent",
  "emotionalDNA": { "tags": ["tag1", "tag2"] },
  "whoIsThisFor": { "watch": "...", "skip": "..." },
  "verdict": "Hinglish verdict max 12 words",
  "dissent": { "type": "overhyped|underseen", "quote": "..." },
  "gateway": { "into": "..." }
}]
Exactly ${resultCount} entries ordered best to worst.`,
      `Query: "${cleanQuery}" | Era: "${era}" | Count: ${resultCount} | Type: ${type}
Community data:\n${rawData.slice(0, 4000) || 'Use deep knowledge of these communities.'}
Return exactly ${resultCount} results.`,
      undefined,
      Math.min(500 + resultCount * 600, 8000)
    )

    const raw = analysisData.content
      .map((c: { text?: string }) => c.text || '').join('')
      .replace(/```json|```/g, '')
      .replace(/[ -]/g, ' ')
      .trim()

    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Could not parse results. Try a different query!')

    let claudeResults
    try {
      claudeResults = JSON.parse(match[0].replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']'))
    } catch {
      const fixRes   = await callClaude('You are a JSON repair tool. Return ONLY valid JSON array.', `Fix:\n${match[0].slice(0, 3000)}`)
      const fixedRaw = fixRes.content.map((c: { text?: string }) => c.text || '').join('').replace(/```json|```/g, '').trim()
      const fixMatch = fixedRaw.match(/\[[\s\S]*\]/)
      if (!fixMatch) throw new Error('Could not parse results. Try a different query!')
      claudeResults  = JSON.parse(fixMatch[0])
    }

    if (!Array.isArray(claudeResults) || claudeResults.length === 0) throw new Error('No results found.')

    // Step 3 — Enrich with OMDB + TMDB
    const enriched = await Promise.all(
      claudeResults.slice(0, resultCount).map(async (item: {
        title: string; year?: string; type: string
        communityScore: number; rewatchIndex: number
        [key: string]: unknown
      }) => {
        const isShow   = item.type !== 'Movie'
        const [omdb, tmdb] = await Promise.all([
          fetchOMDB(item.title, item.year),
          fetchTMDB(item.title, isShow ? 'show' : 'movie', item.year),
        ])
        return {
          ...item,
          imdb:       omdb?.imdb        || 'N/A',
          imdbVotes:  omdb?.imdbVotes   || null,
          rtAudience: omdb?.rtAudience  || null,
          tmdbScore:  tmdb?.tmdbScore   || null,
          tmdbVotes:  tmdb?.tmdbVotes   || null,
          poster:     tmdb?.poster      || omdb?.poster || null,
          backdrop:   tmdb?.backdrop    || null,
          genre:      omdb?.genre       || null,
          runtime:    omdb?.runtime     || null,
          awards:     omdb?.awards      || null,
          finalScore: computeFinalScore({
            communityScore: item.communityScore,
            imdb:           omdb?.imdb      || null,
            rtAudience:     omdb?.rtAudience || null,
            tmdbScore:      tmdb?.tmdbScore  || null,
            rewatchIndex:   item.rewatchIndex,
          }),
        }
      })
    )

    enriched.sort((a, b) => b.finalScore - a.finalScore)
    return NextResponse.json({ results: enriched })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/movies] ERROR:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

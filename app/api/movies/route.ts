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
export const runtime     = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_API    = 'https://api.anthropic.com/v1/messages'
const MODEL            = 'claude-sonnet-4-6'
const MAX_RESULTS      = 20
const MIN_RESULTS      = 1
const MAX_QUERY_LENGTH = 200

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
      imdb:      data.imdbRating !== 'N/A' ? data.imdbRating : null,
      imdbVotes: data.imdbVotes  !== 'N/A' ? data.imdbVotes  : null,
      rtAudience,
      poster:    data.Poster     !== 'N/A' ? data.Poster     : null,
      genre:     data.Genre      || null,
      runtime:   data.Runtime    || null,
      awards:    data.Awards     || null,
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
    const endpoint  = type === 'movie' ? 'movie' : 'tv'
    const params    = new URLSearchParams({
      query: title,
      ...(year ? { first_air_date_year: year, primary_release_year: year } : {}),
    })
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/${endpoint}?${params}`,
      { headers }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const item       = searchData.results?.[0]
    if (!item) return null
    return {
      tmdbScore: item.vote_average ? parseFloat(item.vote_average).toFixed(1) : null,
      tmdbVotes: item.vote_count   || null,
      poster:    item.poster_path   ? `https://image.tmdb.org/t/p/w300${item.poster_path}`  : null,
      backdrop:  item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
      overview:  item.overview      || null,
    }
  } catch { return null }
}

// ── WEIGHTED FINAL SCORE ──────────────────────────────────────────────────────
function computeFinalScore({ communityScore, imdb, rtAudience, tmdbScore, rewatchIndex }: {
  communityScore: number
  imdb:           string | null
  rtAudience:     string | null
  tmdbScore:      string | null
  rewatchIndex:   number
}): number {
  const community = communityScore || 0
  const imdbNorm  = imdb       ? (parseFloat(imdb) / 10) * 10 : community
  const rtNorm    = rtAudience ? parseFloat(rtAudience) / 10   : community
  const tmdbNorm  = tmdbScore  ? parseFloat(tmdbScore)         : community
  const rewatch   = rewatchIndex || 0
  const score     = (community * 0.35) + (imdbNorm * 0.25) + (rtNorm * 0.25) + (rewatch * 0.15)
  return Math.round(score * 10) / 10
}

// ── CLAUDE (with optional tools) ─────────────────────────────────────────────
async function callClaude(
  system:     string,
  userMsg:    string,
  maxTokens = 1000,
  tools?:     object[]
) {
  const body: Record<string, unknown> = {
    model:      MODEL,
    max_tokens: maxTokens,
    system,
    messages:   [{ role: 'user', content: userMsg }],
  }
  if (tools) body.tools = tools

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${err}`)
  }
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
            'Content-Type':    'application/json',
            'x-api-key':       process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model:      MODEL,
            max_tokens: 1000,
            stream:     true,
            system: `You are Laaluyadav — a desi uncle who is a world cinema and television expert.
You answer ANY question about films and TV shows. Brutal honesty, Hinglish wit.
You understand English, Hindi, and Hinglish equally well.
Use web search for ANY film or show released after 2024, or for current ratings, cast, recent releases.
Keep answers concise — max 4-5 sentences. Always end with a punchy Laalu verdict.
Never say you are an AI. You are Laaluyadav. Always.`,
            messages: [{ role: 'user', content: question }],
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          }),
        })

        const reader  = res.body!.getReader()
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
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                console.log('[ASK LAALU] Web search triggered:', parsed.content_block?.name)
              }
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
                console.log('[ASK LAALU] Search query:', parsed.delta?.partial_json)
              }
              const text = parsed.delta?.text || ''
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
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
    }

    const cleanQuery = query.trim().slice(0, MAX_QUERY_LENGTH)
    if (cleanQuery.length < 2) {
      return NextResponse.json({ error: 'Query too short.' }, { status: 400 })
    }

    const blockedPatterns = [/(.)\1{15,}/, /<script/i, /javascript:/i]
    if (blockedPatterns.some(p => p.test(cleanQuery))) {
      return NextResponse.json({ error: 'Invalid query.' }, { status: 400 })
    }

    const resultCount = Math.min(Math.max(parseInt(count) || 5, MIN_RESULTS), MAX_RESULTS)
    const type        = ['movie', 'show', 'both'].includes(contentType) ? contentType : 'both'

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set.' }, { status: 500 })
    }

    // ── STEP 1: WEB SEARCH FOR COMMUNITY SENTIMENT ───────────────────────────
    let rawData = ''
    try {
      console.log('[SEARCH] Starting web search for:', cleanQuery)

      const typeHint = type === 'show' ? 'web series OTT show' : type === 'movie' ? 'movie film' : 'movie show'
      const eraHint  = era === 'recent' ? '2024 2025 2026' : era === 'modern' ? '2010s 2020s' : ''

      const searchData = await callClaude(
        `Search Reddit for community discussions about the query. Extract film/show names, sentiment (positive/negative/mixed), and emotional signals. Return a brief summary only. No headers, no markdown.`,
        `Search for community sentiment about: "${cleanQuery} ${typeHint} ${eraHint} Reddit site:reddit.com"
Also search: "${cleanQuery} ${typeHint} audience reaction review"
Find what real audiences think. Era preference: ${era}.`,
        600,
        [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }]
      )

      rawData = searchData.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text || '')
        .join('\n')

      console.log('[SEARCH] rawData length:', rawData.length)
      console.log('[SEARCH] sample:', rawData.slice(0, 400))
    } catch (err) {
      console.error('[SEARCH] Failed:', err)
      rawData = ''
    }

    // ── STEP 2: ANALYSE AND RANK ─────────────────────────────────────────────
    const typeLabel =
      type === 'movie' ? 'films only' :
      type === 'show'  ? 'TV shows / series only' :
      'both films AND TV shows mixed'

    const analysisData = await callClaude(
      `You are Laaluyadav — desi uncle, world cinema AND television expert. Brutal honesty, Hinglish wit.
Find what the AUDIENCE genuinely loved. Not critics. Not hype. Real human emotion.

CONTENT TYPE: ${typeLabel}

LANGUAGE: understand English, Hindi, Hinglish equally. Extract core intent:
  "yaar khaate hue kuch badhiya dekhna hai" → easy, fun, light
  "kuch aisa jo rona aa jaye" → emotional gut-punch
  "dimag ghoomane wali" → mind-bending thriller
  "date night ke liye" → romantic, beautiful
  "2 baje akela" → dark, atmospheric
  Match to ACTUAL INTENT not just literal words.

SCORING — communityScore out of 10:
  Base    = (positive mentions × 2.0) + (neutral × 0.5) - (negative × 1.5)
  Boost   = high engagement / viral discussions → +1.0
  Penalty = "overrated"/"disappointed"/"fell asleep" → -1.5
  Normalize 0–10

rewatchIndex (0–10): rewatch signals from community
regretScore  (0–10): "wish I found sooner" signals

RATINGS:
  imdb    = IMDB rating
  popcorn = RT AUDIENCE % only (never critic score)

EMOTIONAL DNA — 2–4 punchy tags of actual emotional experience:
  Good: ["Gut-punch ending", "Broke me at 2am", "Rewatch changes everything"]
  Bad: ["Good story"] — rejected

WHO IS THIS FOR: watch/skip in one sentence each

WHY THIS FOR THIS QUERY:
  One punchy sentence — why THIS specifically matches the user's request
  Examples:
  "khaate hue": "Khaate hue perfect — funny enough in background, good enough to put fork down."
  "anurag kashyap": "Ye uska darkest kaam hai — baki sab iske baad samjh aayega."

LAALU DISSENT (optional — only if genuinely true):
  overhyped: high buzz BUT high disappointment signals
  underseen: low mentions BUT extremely high positive intensity
  Quote: brutal Hinglish max 15 words

GATEWAY (optional): specific rabbit hole this opens

VERDICT: brutal Hinglish max 12 words, from real audience feeling.
  Good: "Bhai ye toh life-changing hai, seedha dil mein ghus jaata hai."
  Bad:  "This is a good show." — rejected

ORDER: best to worst by communityScore. Ties by rewatchIndex.

Return ONLY valid JSON array, no markdown, no backticks:
[{
  "title": "string",
  "year": "YYYY",
  "type": "Movie|TV Show|Mini-Series|Docuseries",
  "seasons": "N seasons",
  "taste": "Action Masala|Emotional Drama|Dark Comedy|Slow Burn Thriller|Romance|Horror|Arthouse|Sci-Fi|World Cinema|Feel-Good Comedy|Crime & Mystery|Docuseries|Anthology|Sitcom|Miniseries",
  "description": "2 sentences — what it IS + why audiences lose their mind",
  "whyThisQuery": "one punchy sentence — why THIS for THIS query",
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

Community sentiment data:
${rawData.slice(0, 4000) || 'No search data — use your knowledge of what communities discuss for this query.'}

CRITICAL:
- Prioritise titles from community data above
- If no data: use knowledge of what Reddit/OTT communities historically discuss
- Never return empty array — always return exactly ${resultCount} results
- If query contains a year (e.g. 2026) only return titles from that year
IMPORTANT: Return EXACTLY ${resultCount} results, not more, not less.`,
      Math.min(500 + resultCount * 600, 8000)
    )

    const raw = analysisData.content
      .map((c: { text?: string }) => c.text || '')
      .join('')
      .replace(/```json|```/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim()

    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Could not parse results. Try a different query!')

    let claudeResults
    try {
      claudeResults = JSON.parse(
        match[0]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*\]/g, ']')
      )
    } catch {
      const fixRes    = await callClaude(
        'You are a JSON repair tool. Return ONLY valid JSON array, nothing else.',
        `Fix this broken JSON:\n${match[0].slice(0, 3000)}`
      )
      const fixedRaw  = fixRes.content
        .map((c: { text?: string }) => c.text || '')
        .join('')
        .replace(/```json|```/g, '')
        .trim()
      const fixedMatch = fixedRaw.match(/\[[\s\S]*\]/)
      if (!fixedMatch) throw new Error('Could not parse results. Try a different query!')
      claudeResults = JSON.parse(fixedMatch[0])
    }

    if (!Array.isArray(claudeResults) || claudeResults.length === 0) {
      throw new Error('No results found.')
    }

    // Deduplicate
    const seen = new Set<string>()
    claudeResults = claudeResults.filter((item: { title: string }) => {
      const key = item.title.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    claudeResults = claudeResults.slice(0, resultCount)

    // ── STEP 3: ENRICH WITH OMDB + TMDB ─────────────────────────────────────
    const enriched = await Promise.all(
      claudeResults.map(async (item: {
        title: string
        year?: string
        type: string
        communityScore: number
        rewatchIndex: number
        [key: string]: unknown
      }) => {
        const isShow       = item.type !== 'Movie'
        const [omdb, tmdb] = await Promise.all([
          fetchOMDB(item.title, item.year),
          fetchTMDB(item.title, isShow ? 'show' : 'movie', item.year),
        ])
        return {
          ...item,
          imdb:       omdb?.imdb       || 'N/A',
          imdbVotes:  omdb?.imdbVotes  || null,
          rtAudience: omdb?.rtAudience || null,
          tmdbScore:  tmdb?.tmdbScore  || null,
          tmdbVotes:  tmdb?.tmdbVotes  || null,
          poster:     tmdb?.poster     || omdb?.poster || null,
          backdrop:   tmdb?.backdrop   || null,
          genre:      omdb?.genre      || null,
          runtime:    omdb?.runtime    || null,
          awards:     omdb?.awards     || null,
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

    let userMsg = 'Kuch gadbad ho gayi. Thodi der baad try karo!'
    if (msg.includes('429') || msg.includes('rate_limit')) {
      userMsg = 'Laalu thoda busy hai — 60 seconds mein dobara try karo!'
    } else if (msg.includes('No results found')) {
      userMsg = 'Is query ke liye kuch nahi mila. Thoda alag angle se try karo!'
    } else if (msg.includes('Query too short')) {
      userMsg = 'Thoda aur likho bhai — query bahut choti hai!'
    } else if (msg.includes('Invalid query')) {
      userMsg = 'Ye query valid nahi hai. Kuch aur try karo!'
    }

    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}
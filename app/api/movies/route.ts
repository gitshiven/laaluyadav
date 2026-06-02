import { NextRequest, NextResponse } from 'next/server'

export const runtime     = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-6'

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
      return { allowed: false, message: `Bhai aaj ka quota khatam. Kal aa jaana!` }
    }
  }
  return { allowed: true, message: '' }
}

setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((v, k) => { if (now > v.resetAt) rateLimitMap.delete(k) })
  dailyMap.forEach((v, k)     => { if (now > v.resetAt) dailyMap.delete(k) })
}, 10 * 60 * 1000)

async function fetchOMDB(title: string, year?: string) {
  try {
    const params = new URLSearchParams({
      apikey: process.env.OMDB_API_KEY!,
      t: title, plot: 'short',
      ...(year ? { y: year } : {}),
    })
    const res  = await fetch(`http://www.omdbapi.com/?${params}`)
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
  } catch { return null }
}

async function fetchTMDB(title: string, type: 'movie' | 'show', year?: string) {
  try {
    const headers  = { Authorization: `Bearer ${process.env.TMDB_API_KEY}`, 'Content-Type': 'application/json' }
    const endpoint = type === 'movie' ? 'movie' : 'tv'
    const params   = new URLSearchParams({ query: title, ...(year ? { first_air_date_year: year, primary_release_year: year } : {}) })
    const res      = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?${params}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    const item = data.results?.[0]
    if (!item) return null
    return {
      tmdbScore: item.vote_average ? parseFloat(item.vote_average).toFixed(1) : null,
      tmdbVotes: item.vote_count   || null,
      poster:    item.poster_path   ? `https://image.tmdb.org/t/p/w300${item.poster_path}`  : null,
      backdrop:  item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    }
  } catch { return null }
}

function computeFinalScore({ communityScore, imdb, rtAudience, tmdbScore, rewatchIndex }: {
  communityScore: number; imdb: string | null; rtAudience: string | null
  tmdbScore: string | null; rewatchIndex: number
}): number {
  const community = communityScore || 0
  const imdbNorm  = imdb       ? (parseFloat(imdb) / 10) * 10 : community
  const rtNorm    = rtAudience ? parseFloat(rtAudience) / 10   : community
  const rewatch   = rewatchIndex || 0
  return Math.round(((community * 0.35) + (imdbNorm * 0.25) + (rtNorm * 0.25) + (rewatch * 0.15)) * 10) / 10
}

async function callClaude(system: string, userMsg: string, maxTokens = 1000, tools?: object[]) {
  const body: Record<string, unknown> = {
    model: MODEL, max_tokens: maxTokens, system,
    messages: [{ role: 'user', content: userMsg }],
  }
  if (tools) body.tools = tools
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Anthropic API ${res.status}: ${err}`) }
  return res.json()
}

// ── CHAT ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed, message } = checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: message }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const question = searchParams.get('q')?.trim()
  if (!question) return NextResponse.json({ error: 'No question.' }, { status: 400 })
  if (question.length > 500) return NextResponse.json({ error: 'Too long.' }, { status: 400 })

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
          },
          body: JSON.stringify({
            model: MODEL, max_tokens: 1000, stream: true,
            system: `You are Laaluyadav — desi uncle, world cinema expert. Brutal honesty, Hinglish wit.
Understand English, Hindi, Hinglish equally. Use web search for films/shows after 2024.
Max 4-5 sentences. End with punchy Laalu verdict. Never say you are an AI.`,
            messages: [{ role: 'user', content: question }],
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          }),
        })
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const d = line.replace('data: ', '').trim()
            if (d === '[DONE]') continue
            try {
              const p = JSON.parse(d)
              const text = p.delta?.text || ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode('Arre bhai, kuch gadbad ho gayi. Dobara try karo!'))
        console.error('[chat]', err)
      } finally { controller.close() }
    }
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

// ── RECOMMENDATIONS ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const { allowed, message } = checkRateLimit(ip)
    if (!allowed) return NextResponse.json({ error: message }, { status: 429 })

    const { query, era, count, contentType } = await req.json()
    if (!query || typeof query !== 'string') return NextResponse.json({ error: 'Query is required.' }, { status: 400 })

    const cleanQuery = query.trim().slice(0, 200)
    if (cleanQuery.length < 2) return NextResponse.json({ error: 'Query too short.' }, { status: 400 })

    const blockedPatterns = [/(.)\1{15,}/, /<script/i, /javascript:/i]
    if (blockedPatterns.some(p => p.test(cleanQuery))) return NextResponse.json({ error: 'Invalid query.' }, { status: 400 })

    const resultCount = Math.min(Math.max(parseInt(count) || 5, 1), 20)
    const type        = ['movie', 'show', 'both'].includes(contentType) ? contentType : 'both'
    const typeHint    = type === 'show' ? 'web series OTT' : type === 'movie' ? 'movie film' : 'movie show'
    const typeLabel   = type === 'movie' ? 'films only' : type === 'show' ? 'TV shows only' : 'both films AND TV shows'

    // Step 1 — web search with 12s timeout
    let rawData = ''
    try {
      console.log('[SEARCH] Starting for:', cleanQuery)
      const searchPromise = callClaude(
        `Search Reddit for community discussions. Extract film/show names and sentiment. Max 150 words, no markdown.`,
        `Search Reddit: "${cleanQuery} ${typeHint} site:reddit.com" — what do audiences think?`,
        400,
        [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }]
      )
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('search timeout')), 12000)
      )
      const searchData = await Promise.race([searchPromise, timeoutPromise]) as Awaited<ReturnType<typeof callClaude>>
      rawData = searchData.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text || '')
        .join('\n')
      console.log('[SEARCH] length:', rawData.length)
    } catch (err) {
      console.log('[SEARCH] skipped:', err instanceof Error ? err.message : err)
      rawData = ''
    }

    // Step 2 — analyse
    const analysisData = await callClaude(
      `You are Laaluyadav — desi uncle, world cinema AND television expert. Brutal honesty, Hinglish wit.
Find what the AUDIENCE genuinely loved. Not critics. Not hype. Real human emotion.
CONTENT TYPE: ${typeLabel}
LANGUAGE: understand English, Hindi, Hinglish. Extract core intent:
  "khaate hue" → easy, fun, light | "rona aa jaye" → emotional gut-punch
  "dimag ghoomane wali" → mind-bending | "2 baje akela" → dark, atmospheric
SCORING — communityScore 0-10:
  positive×2.0 + neutral×0.5 - negative×1.5, normalize. Boost viral +1.0. Penalty "overrated" -1.5
rewatchIndex/regretScore 0-10 from community signals
EMOTIONAL DNA: 2-4 punchy tags. Bad: ["Good story"] — rejected
WHO IS THIS FOR: watch/skip one sentence each
WHY THIS QUERY: one punchy Hinglish sentence why THIS for THIS request
LAALU DISSENT optional: overhyped/underseen Hinglish quote max 15 words
GATEWAY optional: specific rabbit hole
VERDICT: brutal Hinglish max 12 words
Return ONLY valid JSON array no markdown:
[{"title":"string","year":"YYYY","type":"Movie|TV Show|Mini-Series|Docuseries","seasons":"N seasons","taste":"Action Masala|Emotional Drama|Dark Comedy|Slow Burn Thriller|Romance|Horror|Arthouse|Sci-Fi|World Cinema|Feel-Good Comedy|Crime & Mystery|Docuseries|Anthology|Sitcom|Miniseries","description":"2 sentences","whyThisQuery":"one sentence","communityScore":8.6,"rewatchIndex":9.1,"regretScore":8.4,"buzzIndex":"Insane|Very High|High|Decent","emotionalDNA":{"tags":["tag1","tag2"]},"whoIsThisFor":{"watch":"...","skip":"..."},"verdict":"max 12 words","dissent":{"type":"overhyped|underseen","quote":"..."},"gateway":{"into":"..."}}]
Exactly ${resultCount} entries ordered best to worst.`,
      `Query: "${cleanQuery}" | Era: "${era}" | Count: ${resultCount} | Type: ${type}
Community data: ${rawData.slice(0, 2000) || 'Use your knowledge of what communities discuss for this query.'}
Return EXACTLY ${resultCount} results. Not more, not less.`,
      Math.min(500 + resultCount * 500, 6000)
    )

    const raw = analysisData.content
      .map((c: { text?: string }) => c.text || '').join('')
      .replace(/```json|```/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim()

    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Could not parse results. Try a different query!')

    let results = JSON.parse(match[0].replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']'))
    if (!Array.isArray(results) || results.length === 0) throw new Error('No results found.')

    const seen = new Set<string>()
    results = results.filter((item: { title: string }) => {
      const key = item.title.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, resultCount)

    const enriched = await Promise.all(
      results.map(async (item: { title: string; year?: string; type: string; communityScore: number; rewatchIndex: number; [key: string]: unknown }) => {
        const isShow = item.type !== 'Movie'
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
    if (msg.includes('429') || msg.includes('rate_limit')) userMsg = 'Laalu thoda busy hai — 60 seconds mein dobara try karo!'
    else if (msg.includes('No results'))  userMsg = 'Is query ke liye kuch nahi mila. Thoda alag angle se try karo!'
    else if (msg.includes('too short'))   userMsg = 'Thoda aur likho bhai!'
    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}
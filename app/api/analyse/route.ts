import { NextRequest, NextResponse } from 'next/server'

export const runtime     = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-6'

async function fetchOMDB(title: string, year?: string) {
  try {
    const params = new URLSearchParams({
      apikey: process.env.OMDB_API_KEY!,
      t:      title,
      plot:   'short',
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
  const score     = (community * 0.35) + (imdbNorm * 0.25) + (rtNorm * 0.25) + (rewatch * 0.15)
  return Math.round(score * 10) / 10
}

export async function POST(req: NextRequest) {
  try {
    const { query, era, count, type, rawData } = await req.json()

    const resultCount = Math.min(Math.max(parseInt(count) || 5, 1), 20)
    const typeLabel   = type === 'movie' ? 'films only' : type === 'show' ? 'TV shows only' : 'both films AND TV shows'

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: Math.min(500 + resultCount * 600, 8000),
        system: `You are Laaluyadav — desi uncle, world cinema AND television expert. Brutal honesty, Hinglish wit.
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
  Boost   = high engagement → +1.0
  Penalty = "overrated"/"disappointed"/"fell asleep" → -1.5
  Normalize 0–10

rewatchIndex (0–10): rewatch signals
regretScore  (0–10): "wish I found sooner" signals

EMOTIONAL DNA — 2–4 punchy tags:
  Good: ["Gut-punch ending", "Broke me at 2am", "Rewatch changes everything"]
  Bad: ["Good story"] — rejected

WHO IS THIS FOR: watch/skip in one sentence each

WHY THIS FOR THIS QUERY:
  One punchy sentence — why THIS specifically for this request

LAALU DISSENT (optional): overhyped/underseen with Hinglish quote max 15 words
GATEWAY (optional): specific rabbit hole this opens
VERDICT: brutal Hinglish max 12 words from real audience feeling

ORDER: best to worst by communityScore.

Return ONLY valid JSON array, no markdown:
[{
  "title": "string",
  "year": "YYYY",
  "type": "Movie|TV Show|Mini-Series|Docuseries",
  "seasons": "N seasons",
  "taste": "Action Masala|Emotional Drama|Dark Comedy|Slow Burn Thriller|Romance|Horror|Arthouse|Sci-Fi|World Cinema|Feel-Good Comedy|Crime & Mystery|Docuseries|Anthology|Sitcom|Miniseries",
  "description": "2 sentences",
  "whyThisQuery": "one punchy sentence",
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
        messages: [{ role: 'user', content: `Query: "${query}" | Era: "${era}" | Count: ${resultCount} | Type: ${type}

Community data:
${rawData || 'No search data — use your knowledge.'}

Return EXACTLY ${resultCount} results. Not more, not less.` }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${err}`)
    }
    const data = await res.json()

    const raw = data.content
      .map((c: { text?: string }) => c.text || '')
      .join('')
      .replace(/```json|```/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim()

    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Could not parse results.')

    let results = JSON.parse(
      match[0].replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']')
    )

    if (!Array.isArray(results) || results.length === 0) throw new Error('No results found.')

    // Deduplicate
    const seen = new Set<string>()
    results = results.filter((item: { title: string }) => {
      const key = item.title.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, resultCount)

    // Enrich with OMDB + TMDB
    const enriched = await Promise.all(
      results.map(async (item: {
        title: string; year?: string; type: string
        communityScore: number; rewatchIndex: number
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
    console.error('[ANALYSE] ERROR:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
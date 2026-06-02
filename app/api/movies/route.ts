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
            'Content-Type':      'application/json',
            'x-api-key':         process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model:      MODEL,
            max_tokens: 1000,
            stream:     true,
            system: `You are Laaluyadav — a desi uncle who is a world cinema and television expert.
Brutal honesty, Hinglish wit. Understand English, Hindi, Hinglish equally.
Use web search for ANY film or show released after 2024, or for current ratings and recent releases.
Max 4-5 sentences. Always end with a punchy Laalu verdict.
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
                console.log('[ASK LAALU] Web search:', parsed.content_block?.name)
              }
              const text = parsed.delta?.text || ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode('Arre bhai, kuch gadbad ho gayi. Dobara try karo!'))
        console.error('[chat] error:', err)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' }
  })
}

// ── RECOMMENDATIONS — now delegates to /api/search + /api/analyse ─────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const { allowed, message } = checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: message }, { status: 429 })

  try {
    const body = await req.json()
    const { query, era, count, contentType } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
    }
    const cleanQuery = query.trim().slice(0, 200)
    if (cleanQuery.length < 2) {
      return NextResponse.json({ error: 'Query too short.' }, { status: 400 })
    }

    const blockedPatterns = [/(.)\1{15,}/, /<script/i, /javascript:/i]
    if (blockedPatterns.some(p => p.test(cleanQuery))) {
      return NextResponse.json({ error: 'Invalid query.' }, { status: 400 })
    }

    const baseUrl = req.nextUrl.origin

    // Step 1 — search
    let rawData = ''
    try {
      const searchRes = await fetch(`${baseUrl}/api/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: cleanQuery, era, type: contentType }),
      })
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        rawData = searchData.rawData || ''
      }
    } catch { rawData = '' }

    // Step 2 — analyse
    const analyseRes = await fetch(`${baseUrl}/api/analyse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: cleanQuery, era, count, type: contentType, rawData }),
    })

    if (!analyseRes.ok) {
      const err = await analyseRes.json()
      throw new Error(err.error || 'Analysis failed')
    }

    const result = await analyseRes.json()
    return NextResponse.json(result)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/movies] ERROR:', msg)

    let userMsg = 'Kuch gadbad ho gayi. Thodi der baad try karo!'
    if (msg.includes('429') || msg.includes('rate_limit')) {
      userMsg = 'Laalu thoda busy hai — 60 seconds mein dobara try karo!'
    } else if (msg.includes('No results')) {
      userMsg = 'Is query ke liye kuch nahi mila. Thoda alag angle se try karo!'
    } else if (msg.includes('too short')) {
      userMsg = 'Thoda aur likho bhai — query bahut choti hai!'
    }

    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}
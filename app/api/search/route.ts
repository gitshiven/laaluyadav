import { NextRequest, NextResponse } from 'next/server'

export const runtime     = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-6'

export async function POST(req: NextRequest) {
  try {
    const { query, era, type } = await req.json()
    if (!query) return NextResponse.json({ rawData: '' })

    const typeHint = type === 'show' ? 'web series OTT show' : type === 'movie' ? 'movie film' : 'movie show'

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 600,
        system:     `Search Reddit for community discussions. Extract film/show names, sentiment, emotional signals. Return brief summary only. No headers, no markdown, under 300 words.`,
        messages:   [{ role: 'user', content: `Search Reddit for: "${query} ${typeHint} site:reddit.com". Era: ${era}. What do audiences think? Which titles do they love or hate?` }],
        tools:      [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
      }),
    })

    if (!res.ok) return NextResponse.json({ rawData: '' })
    const data = await res.json()

    const rawData = data.content
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text?: string }) => c.text || '')
      .join('\n')

    console.log('[SEARCH] rawData length:', rawData.length)
    return NextResponse.json({ rawData })

  } catch (err) {
    console.error('[SEARCH] failed:', err)
    return NextResponse.json({ rawData: '' })
  }
}
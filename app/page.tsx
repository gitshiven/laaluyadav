'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MovieCard } from '@/components/MovieCard'
import { Logo } from '@/components/Logo'
import type { Result, ChatMessage } from '@/lib/types'
import { getLaaluLine, LOADING_MSGS } from '@/lib/utils'

type Tab  = 'movie' | 'show' | 'both'
type Mode = 'search' | 'chat'

export default function Home() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const [mode, setMode]             = useState<Mode>('search')
  const [query, setQuery]           = useState(searchParams.get('q') || '')
  const [era, setEra]               = useState(searchParams.get('era') || 'all')
  const [count, setCount]           = useState(parseInt(searchParams.get('count') || '5'))
  const [tab, setTab]               = useState<Tab>((searchParams.get('type') as Tab) || 'both')
  const [loading, setLoading]       = useState(false)
  const [results, setResults]       = useState<Result[]>([])
  const [error, setError]           = useState('')
  const [laalu, setLaalu]           = useState('')
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0])
  const [progress, setProgress]     = useState(0)
  const [resultMeta, setResultMeta] = useState('')
  const [copied, setCopied]         = useState(false)

  // Chat state
  const [chatInput, setChatInput]     = useState('')
  const [chatMsgs, setChatMsgs]       = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  const msgRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const resultsRef    = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const logoSize = 56

  // Auto-search if URL has query params
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) handleSearch(q, searchParams.get('type') as Tab || 'both', searchParams.get('era') || 'all', parseInt(searchParams.get('count') || '5'))
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs])

  async function handleSearch(
    q = query,
    t = tab,
    e = era,
    c = count,
  ) {
    if (!q.trim()) return
    setLoading(true)
    setResults([])
    setError('')
    setLaalu('')
    setProgress(0)

    // Update URL with share params
    const params = new URLSearchParams({ q: q.trim(), type: t, era: e, count: String(c) })
    router.replace(`?${params.toString()}`, { scroll: false })

    let msgIdx = 0
    if (msgRef.current)      clearInterval(msgRef.current)
    if (progressRef.current) clearInterval(progressRef.current)

    msgRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MSGS.length
      setLoadingMsg(LOADING_MSGS[msgIdx])
    }, 2000)

    const steps = [10, 25, 45, 65, 82, 92]
    let si = 0
    progressRef.current = setInterval(() => {
      if (si < steps.length) setProgress(steps[si++])
    }, 2000)

    try {
      console.log('[SEARCH] count:', c, 'tab:', t, 'era:', e)
      const res  = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim(), era: e, count: c, contentType: t }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error')

      clearInterval(msgRef.current!)
      clearInterval(progressRef.current!)
      setProgress(100)

      const eraLabel: Record<string, string> = {
        all: 'All Time', modern: 'Modern (2010+)', classic: 'Classic (pre-2000)', recent: 'Recent (2020+)',
      }
      const typeLabel: Record<Tab, string> = { both: 'Movies & Shows', movie: 'Movies', show: 'TV Shows' }

      setResultMeta(`${data.results.length} picks · ${typeLabel[t]} · ${eraLabel[e]} · ${q}`)
      setLaalu(getLaaluLine(data.results.length))

      // Stream cards in one by one
      for (let i = 0; i < data.results.length; i++) {
        await new Promise(r => setTimeout(r, 150))
        setResults(prev => [...prev, data.results[i]])
      }

      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: unknown) {
      clearInterval(msgRef.current!)
      clearInterval(progressRef.current!)
      const msg = e instanceof Error ? e.message : ''

      if (msg.includes('429') || msg.includes('rate_limit')) {
        setError('Laalu thoda busy hai abhi — 60 seconds mein dobara try karo! ⏱️')
      } else if (msg.includes('500') || msg.includes('Internal')) {
        setError('Kuch gadbad ho gayi. Thodi der baad try karo!')
      } else if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
        setError('Laalu time out ho gaya — query thodi simple rakho aur dobara try karo!')
      } else if (msg.includes('parse') || msg.includes('JSON')) {
        setError('Laalu confuse ho gaya — query thodi alag karke try karo!')
      } else {
        setError('Kuch toh gadbad hai, par Laalu haar nahi maanta. Dobara try karo!')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleChat() {
    if (!chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    setChatMsgs(prev => [...prev, { role: 'user', text: question }])
    setChatLoading(true)

    let answer = ''
    setChatMsgs(prev => [...prev, { role: 'laalu', text: '...' }])

    try {
      const res    = await fetch(`/api/movies?q=${encodeURIComponent(question)}`)
      const reader = res.body!.getReader()
      const dec    = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        answer += dec.decode(value)
        setChatMsgs(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'laalu', text: answer }
          return updated
        })
      }
    } catch {
      setChatMsgs(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'laalu', text: 'Arre bhai, kuch gadbad ho gayi. Dobara try karo!' }
        return updated
      })
    } finally {
      setChatLoading(false)
    }
  }

  function tabStyle(t: Tab): React.CSSProperties {
    const active = tab === t
    return {
      fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem',
      letterSpacing: '0.08em', padding: '0.4rem 1rem', cursor: 'pointer',
      border: '2px solid', borderColor: active ? '#FFE600' : '#444',
      background: active ? '#FFE600' : 'transparent',
      color: active ? '#0D0D0D' : '#888', transition: 'all 0.15s',
      whiteSpace: 'nowrap' as const, flexShrink: 0,
    }
  }

  function modeStyle(m: Mode): React.CSSProperties {
    const active = mode === m
    return {
      fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem',
      letterSpacing: '0.1em', padding: '0.5rem 1.5rem', cursor: 'pointer',
      border: '3px solid', borderColor: active ? '#FFE600' : '#444',
      background: active ? '#FFE600' : 'transparent',
      color: active ? '#0D0D0D' : '#888', transition: 'all 0.15s',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <>
      {/* ── HEADER ── */}
      <header style={{ background: '#0D0D0D', borderBottom: '5px solid #0D0D0D' }}>
        <div style={{ background: '#E8001D', height: 6 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(0.8rem,3vw,1.5rem) clamp(1rem,4vw,2.5rem)', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.6rem,2vw,1.2rem)' }}>
            <Logo size={logoSize} />
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2rem,6vw,5rem)', color: '#FFE600', lineHeight: 0.9, letterSpacing: '0.05em', textShadow: '3px 3px 0 #E8001D' }}>
                LAALUYADAV
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.45rem,1.2vw,0.65rem)', color: '#E8001D', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                The Movie & Show Oracle · World Cinema & Television
              </div>
            </div>
          </div>
          <div style={{ background: '#FFE600', border: '3px solid #FFE600', color: '#0D0D0D', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(0.6rem,1.5vw,0.95rem)', letterSpacing: '0.1em', padding: '0.3rem 0.8rem', transform: 'rotate(-2deg)', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
            <span>DESI UNCLE</span>
            <span style={{ color: '#E8001D', fontSize: 'clamp(0.5rem,1.2vw,0.75rem)' }}>CERTIFIED</span>
          </div>
        </div>
        <div style={{ background: '#E8001D', padding: '0.3rem 0', overflow: 'hidden', borderTop: '2px solid #FFE600' }}>
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: 'ticker 30s linear infinite', fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.55rem,1.5vw,0.7rem)', color: '#FFE600', letterSpacing: '0.1em' }}>
            ★ SEPARATING HYPE FROM TRUTH ★ AUDIENCE SENTIMENT ★ REWATCH INDEX ★ REGRET SCORE ★ LAALU DISSENT ★ GATEWAY DETECTION ★ IMDB · RT · TMDB · COMMUNITY ★ ASK LAALU ANYTHING ★ NO FILMY NONSENSE ★ &nbsp;&nbsp;
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(1.2rem,4vw,2.5rem) clamp(0.8rem,3vw,1.5rem) 4rem' }}>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', border: '3px solid #0D0D0D', width: 'fit-content' }}>
          <button style={modeStyle('search')} onClick={() => setMode('search')}>🎬 Get Picks</button>
          <button style={{ ...modeStyle('chat'), borderLeft: 'none' }} onClick={() => setMode('chat')}>💬 Ask Laalu</button>
        </div>

        {/* ── SEARCH MODE ── */}
        {mode === 'search' && (
          <>
            <div style={{ background: '#0D0D0D', border: '5px solid #0D0D0D', padding: 'clamp(1rem,3vw,2rem)', marginBottom: '2rem', position: 'relative' }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#FFE600', letterSpacing: '0.2em', position: 'absolute', top: '-0.6rem', left: '1.2rem', background: '#0D0D0D', padding: '0 0.5rem' }}>
                WHAT DO YOU WANT TO WATCH?
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
                <button style={tabStyle('both')}  onClick={() => setTab('both')}>🎬 Movies + Shows</button>
                <button style={tabStyle('movie')} onClick={() => setTab('movie')}>🎥 Movies Only</button>
                <button style={tabStyle('show')}  onClick={() => setTab('show')}>📺 TV Shows Only</button>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 240px', minWidth: 0 }}>
                  <label style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#FFE600', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    Mood / Genre / Vibe / Director / Actor / Hinglish OK
                  </label>
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. khaate hue kuch funny, anurag kashyap best, dark psychological..." />
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 110 }}>
                    <label style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#FFE600', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Era</label>
                    <select value={era} onChange={e => setEra(e.target.value)}>
                      <option value="all">All Time</option>
                      <option value="modern">Modern (2010+)</option>
                      <option value="classic">Classic (pre-2000)</option>
                      <option value="recent">Recent (2020+)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 80 }}>
                    <label style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#FFE600', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Results</label>
                    <select value={count} onChange={e => setCount(parseInt(e.target.value))}>
                      <option value={1}>1 — Just tell me</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                  <button onClick={() => handleSearch()} disabled={loading}
                    style={{ background: loading ? '#555' : '#E8001D', border: '3px solid', borderColor: loading ? '#555' : '#E8001D', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.1rem,3vw,1.4rem)', letterSpacing: '0.1em', padding: 'clamp(0.5rem,1.5vw,0.55rem) clamp(1rem,3vw,2rem)', cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: loading ? 0.6 : 1, alignSelf: 'flex-end' }}>
                    {loading ? 'ASKING...' : 'ASK LAALU ↗'}
                  </button>
                </div>
              </div>
            </div>

            {loading && (
              <div style={{ background: '#0D0D0D', border: '5px solid #0D0D0D', padding: 'clamp(1.5rem,4vw,3rem) 2rem', textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.8rem,5vw,3rem)', color: '#FFE600', textShadow: '3px 3px 0 #E8001D', animation: 'flicker 1.5s infinite' }}>
                  CONSULTING THE ORACLE...
                </div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.6rem,1.5vw,0.75rem)', color: '#E8001D', letterSpacing: '0.2em', marginTop: '1rem', animation: 'pulse 0.8s infinite' }}>
                  {loadingMsg}
                </div>
                <div style={{ background: '#222', height: 4, marginTop: '1.5rem', overflow: 'hidden' }}>
                  <div style={{ background: '#FFE600', height: '100%', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#E8001D', border: '5px solid #0D0D0D', padding: '1.2rem', marginBottom: '1.5rem' }}>
                <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.65rem,1.5vw,0.8rem)', color: '#fff', lineHeight: 1.6 }}>
                  🎬 LAALU SAYS: {error}
                </p>
              </div>
            )}

            {laalu && (
              <div style={{ background: '#FFE600', border: '5px solid #0D0D0D', padding: 'clamp(0.8rem,2vw,1.2rem) clamp(0.8rem,3vw,1.5rem)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                  <Logo size={48} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.65rem,1.5vw,0.78rem)', lineHeight: 1.7, color: '#0D0D0D', fontStyle: 'italic' }}>{laalu}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(0.9rem,2vw,1.1rem)', color: '#E8001D' }}>— LAALUYADAV</span>
                      <button onClick={handleShare} style={{ background: '#0D0D0D', border: '2px solid #0D0D0D', color: '#FFE600', fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', padding: '0.3rem 0.8rem', cursor: 'pointer', letterSpacing: '0.1em' }}>
                        {copied ? '✓ COPIED!' : '🔗 SHARE THIS LIST'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div ref={resultsRef}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.8rem,5vw,2.5rem)', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {results.length === 1 ? "LAALU'S #1 PICK" : `TOP ${results.length} PICKS`}
                  </span>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.55rem,1.2vw,0.65rem)', color: '#777', letterSpacing: '0.08em' }}>{resultMeta}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.6rem 0.8rem', background: '#0D0D0D', border: '3px solid #0D0D0D' }}>
                  {[
                    { label: '🎯 Why This',     desc: 'Why it matches your query' },
                    { label: '◈ Emotional DNA', desc: 'How it feels' },
                    { label: '✓/✗ For You',     desc: 'Watch/skip' },
                    { label: '🔁 Rewatch',       desc: 'Rewatchability' },
                    { label: '😬 Regret',        desc: '"Found too late"' },
                    { label: '🚪 Gateway',       desc: 'Rabbit hole' },
                    { label: '🚩 Dissent',       desc: 'Laalu vs crowd' },
                    { label: '⚡ Final Score',   desc: 'All 4 sources' },
                  ].map(item => (
                    <div key={item.label} style={{ fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.45rem,1vw,0.55rem)', color: '#888', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#FFE600' }}>{item.label}</span> — {item.desc}
                    </div>
                  ))}
                </div>

                <div>
                  {results.map((r, i) => <MovieCard key={r.title + i} result={r} rank={i + 1} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CHAT MODE ── */}
        {mode === 'chat' && (
          <div style={{ border: '5px solid #0D0D0D', background: '#fff' }}>
            <div style={{ background: '#0D0D0D', padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <Logo size={36} />
              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.2rem', color: '#FFE600', letterSpacing: '0.1em' }}>ASK LAALU ANYTHING</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.5rem', color: '#888', letterSpacing: '0.1em' }}>HINDI · HINGLISH · ENGLISH · NO FILTER</div>
              </div>
            </div>

            <div style={{ minHeight: 300, maxHeight: 500, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {chatMsgs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.7rem', color: '#aaa', lineHeight: 2 }}>
                    <div>Kuch bhi pucho:</div>
                    <div style={{ color: '#888', marginTop: '0.5rem' }}>
                      {[
                        '"Parasite ka ending explain karo"',
                        '"kya Interstellar overrated hai?"',
                        '"Dark Season 2 dekhni chahiye?"',
                        '"yaar khaate hue kuch funny batao"',
                        '"best Scorsese film konsi hai?"',
                      ].map(q => (
                        <div key={q}
                          onClick={() => { setChatInput(q.replace(/"/g, '')) }}
                          style={{ cursor: 'pointer', padding: '0.3rem 0.6rem', margin: '0.2rem auto', background: '#f5f5f5', border: '1px solid #eee', display: 'inline-block', fontSize: '0.65rem', borderRadius: 2 }}>
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {chatMsgs.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.6rem', alignItems: 'flex-start' }}>
                  {msg.role === 'laalu' && <Logo size={32} />}
                  <div style={{
                    maxWidth: '75%',
                    background: msg.role === 'user' ? '#0D0D0D' : '#FFE600',
                    color: msg.role === 'user' ? '#FFE600' : '#0D0D0D',
                    padding: '0.7rem 1rem',
                    fontFamily: "'Space Mono',monospace",
                    fontSize: 'clamp(0.65rem,1.5vw,0.75rem)',
                    lineHeight: 1.7,
                    border: '2px solid #0D0D0D',
                  }}>
                    {msg.text === '...'
                      ? <span style={{ animation: 'pulse 0.8s infinite', display: 'inline-block' }}>Laalu soch raha hai...</span>
                      : msg.text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
                    }
                  </div>
                  {msg.role === 'user' && (
                    <div style={{ width: 32, height: 32, background: '#0D0D0D', border: '2px solid #0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>👤</div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <div style={{ borderTop: '3px solid #0D0D0D', display: 'flex', gap: 0 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                placeholder="Kuch bhi pucho — Hindi, Hinglish, English..."
                style={{ flex: 1, border: 'none', borderRight: '3px solid #0D0D0D', background: '#0D0D0D', color: '#FFE600', fontFamily: "'Space Mono',monospace", fontSize: '0.8rem', padding: '0.8rem 1rem', outline: 'none' }}
              />
              <button onClick={handleChat} disabled={chatLoading}
                style={{ background: chatLoading ? '#555' : '#E8001D', border: 'none', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', letterSpacing: '0.1em', padding: '0.8rem 1.5rem', cursor: chatLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {chatLoading ? '...' : 'SEND ↗'}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '5px solid #0D0D0D', background: '#0D0D0D', padding: 'clamp(0.8rem,2vw,1rem) clamp(1rem,4vw,2.5rem)', display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginTop: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Logo size={32} />
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#555', letterSpacing: '0.1em' }}>LAALUYADAV v4.0</span>
        </div>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#555', letterSpacing: '0.1em' }}>
          IMDB · RT AUDIENCE · TMDB · <span style={{ color: '#E8001D' }}>COMMUNITY SENTIMENT</span>
        </p>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: '#555', letterSpacing: '0.1em' }}>
          WORLD CINEMA & TV · <span style={{ color: '#E8001D' }}>ANY LANGUAGE, ANY ERA</span>
        </p>
      </footer>
    </>
  )
}

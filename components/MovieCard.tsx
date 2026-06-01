'use client'

import { useEffect, useRef } from 'react'
import type { Result } from '@/lib/types'
import { getTasteStyle } from '@/lib/utils'

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) ref.current.style.width = Math.min(100, pct) + '%'
    }, 400)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ background: '#ddd', height: 3, marginTop: '0.3rem' }}>
      <div ref={ref} style={{ height: '100%', width: 0, transition: 'width 1s ease', background: color }} />
    </div>
  )
}

function MiniMeter({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ background: '#F5F0E8', border: '2px solid #0D0D0D', padding: '0.4rem 0.6rem', flex: '1 1 90px', minWidth: 80 }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.48rem', letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1rem, 3vw, 1.4rem)', color: '#0D0D0D', lineHeight: 1 }}>{value}</div>
      <AnimatedBar pct={pct} color={color} />
    </div>
  )
}

function IndexDot({ value, label }: { value: number; label: string }) {
  const color = value >= 8 ? '#E8001D' : value >= 6 ? '#FF8C00' : '#888'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 48 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.95rem', color, background: '#fff' }}>
        {value?.toFixed(1)}
      </div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.42rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

export function MovieCard({ result, rank }: { result: Result; rank: number }) {
  const taste        = getTasteStyle(result.taste)
  const imdbPct      = (parseFloat(result.imdb) || 0) / 10 * 100
  const rtPct        = parseFloat(result.rtAudience || '0')
  const tmdbPct      = (parseFloat(result.tmdbScore || '0')) * 10
  const communityPct = (result.communityScore / 10) * 100
  const finalPct     = ((result.finalScore || 0) / 10) * 100

  const typeBg: Record<string, string> = {
    'Movie': '#0D0D0D', 'TV Show': '#003366',
    'Mini-Series': '#1B4332', 'Docuseries': '#2D0054',
  }

  return (
    <div style={{
      background: '#fff',
      border: '4px solid #0D0D0D',
      borderTop: rank === 1 ? '4px solid #0D0D0D' : 'none',
      position: 'relative',
      animation: `slideIn 0.4s ease ${rank * 0.08}s both`,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 'clamp(40px, 6vw, 56px)',
        background: '#0D0D0D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '0.15rem',
      }}>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.42rem', color: '#555', letterSpacing: '0.08em' }}>RANK</span>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#FFE600', lineHeight: 1 }}>{rank}</span>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.38rem', background: typeBg[result.type] || '#0D0D0D', color: '#FFE600', padding: '1px 3px', letterSpacing: '0.04em', textAlign: 'center' }}>
          {result.type === 'TV Show' ? 'TV' : result.type === 'Mini-Series' ? 'MINI' : result.type === 'Docuseries' ? 'DOC' : 'FILM'}
        </span>
      </div>

      <div style={{ marginLeft: 'clamp(40px, 6vw, 56px)', padding: 'clamp(0.7rem, 2vw, 1rem) clamp(0.7rem, 2vw, 1.2rem)' }}>

        {result.poster && (
          <div style={{ float: 'right', marginLeft: '0.8rem', marginBottom: '0.4rem' }}>
            <img src={result.poster} alt={result.title}
              style={{ width: 'clamp(52px, 8vw, 72px)', height: 'clamp(78px, 12vw, 108px)', objectFit: 'cover', border: '2px solid #0D0D0D', display: 'block' }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.2rem, 4vw, 1.7rem)', letterSpacing: '0.03em', lineHeight: 1 }}>{result.title}</span>
          {result.year    && <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.62rem', color: '#999', border: '1.5px solid #ddd', padding: '0.1rem 0.3rem' }}>{result.year}</span>}
          {result.seasons && <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.58rem', color: '#666', border: '1.5px solid #eee', padding: '0.1rem 0.3rem' }}>{result.seasons}</span>}
          {result.runtime && <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.58rem', color: '#888' }}>{result.runtime}</span>}
        </div>

        <span style={{ display: 'inline-block', fontFamily: "'Space Mono',monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.18rem 0.5rem', marginBottom: '0.5rem', background: taste.bg, color: taste.text, border: `1.5px solid ${taste.border}` }}>
          {result.taste}
        </span>

        <p style={{ fontSize: 'clamp(0.75rem, 2vw, 0.83rem)', color: '#333', lineHeight: 1.6, marginBottom: '0.7rem', clear: 'none' }}>
          {result.description}
        </p>

        {result.whyThisQuery && (
          <div style={{ background: '#0D0D0D', border: '2px solid #0D0D0D', padding: '0.4rem 0.7rem', marginBottom: '0.7rem' }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.48rem', color: '#FFE600', letterSpacing: '0.1em', display: 'block', marginBottom: '0.15rem' }}>🎯 WHY THIS FOR YOUR QUERY</span>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: '#F5F0E8', lineHeight: 1.5, fontStyle: 'italic' }}>{result.whyThisQuery}</span>
          </div>
        )}

        {result.emotionalDNA?.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.7rem', clear: 'both' }}>
            {result.emotionalDNA.tags.map((tag, i) => (
              <span key={i} style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.55rem', padding: '0.18rem 0.5rem', background: '#0D0D0D', color: '#FFE600', letterSpacing: '0.04em' }}>
                ◈ {tag}
              </span>
            ))}
          </div>
        )}

        {result.whoIsThisFor && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem', marginBottom: '0.7rem' }}>
            <div style={{ background: '#f0fff0', border: '1.5px solid #006400', padding: '0.4rem 0.6rem' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.48rem', color: '#006400', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>✓ WATCH IF</div>
              <div style={{ fontSize: 'clamp(0.68rem, 1.8vw, 0.75rem)', color: '#333', lineHeight: 1.4 }}>{result.whoIsThisFor.watch}</div>
            </div>
            <div style={{ background: '#fff5f5', border: '1.5px solid #E8001D', padding: '0.4rem 0.6rem' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.48rem', color: '#E8001D', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>✗ SKIP IF</div>
              <div style={{ fontSize: 'clamp(0.68rem, 1.8vw, 0.75rem)', color: '#333', lineHeight: 1.4 }}>{result.whoIsThisFor.skip}</div>
            </div>
          </div>
        )}

        {result.gateway && (
          <div style={{ background: '#FFE600', border: '2px solid #0D0D0D', padding: '0.35rem 0.6rem', marginBottom: '0.7rem', display: 'inline-block' }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.55rem', color: '#0D0D0D', letterSpacing: '0.07em' }}>
              🚪 GATEWAY INTO: <strong>{result.gateway.into}</strong>
            </span>
          </div>
        )}

        {result.dissent && (
          <div style={{ background: result.dissent.type === 'overhyped' ? '#fff0f0' : '#f0fff0', border: `2px solid ${result.dissent.type === 'overhyped' ? '#E8001D' : '#006400'}`, padding: '0.4rem 0.6rem', marginBottom: '0.7rem' }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.52rem', color: result.dissent.type === 'overhyped' ? '#E8001D' : '#006400', letterSpacing: '0.08em', display: 'block', marginBottom: '0.15rem' }}>
              {result.dissent.type === 'overhyped' ? '🚩 LAALU DISAGREES' : '✅ LAALU OVERRIDE'}
            </span>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: '#0D0D0D', fontStyle: 'italic' }}>"{result.dissent.quote}"</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flex: '1 1 280px', flexWrap: 'wrap' }}>
            <MiniMeter label="IMDB"           value={result.imdb || 'N/A'}                                pct={imdbPct}      color="#F5C518" />
            {result.rtAudience && result.rtAudience !== 'N/A' ? (
              <MiniMeter label="🍅 RT" value={`${result.rtAudience}%`} pct={rtPct} color="#E8001D" />
            ) : result.tmdbScore && result.tmdbScore !== 'N/A' ? (
              <MiniMeter label="🍿 TMDB Audience" value={`${result.tmdbScore}/10`} pct={(parseFloat(result.tmdbScore) / 10) * 100} color="#01B4E4" />
            ) : null}
            <MiniMeter label="Community"      value={`${result.communityScore?.toFixed(1)}/10`}            pct={communityPct} color="#0D0D0D" />
            <MiniMeter label="⚡ Final Score" value={`${result.finalScore?.toFixed(1)}/10`}                pct={finalPct}     color="#FFE600" />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', paddingTop: '0.1rem', flexWrap: 'wrap' }}>
            <IndexDot value={result.rewatchIndex} label="Rewatch" />
            <IndexDot value={result.regretScore}  label="Regret"  />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.72rem', letterSpacing: '0.08em', padding: '0.2rem 0.45rem', background: result.buzzIndex === 'Insane' ? '#E8001D' : result.buzzIndex === 'Very High' ? '#FF8C00' : result.buzzIndex === 'High' ? '#0D0D0D' : '#888', color: '#fff' }}>
                {result.buzzIndex}
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.42rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Buzz</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: '#0D0D0D', padding: `0.4rem 1rem 0.4rem clamp(44px, 7vw, 68px)`, fontFamily: "'Space Mono',monospace", fontSize: 'clamp(0.55rem, 1.2vw, 0.62rem)', color: '#FFE600', letterSpacing: '0.07em', borderTop: '2px solid #0D0D0D' }}>
        💬 LAALU SEZ: {result.verdict}
      </div>
    </div>
  )
}
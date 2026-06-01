'use client'

export function Logo({ size = 56 }: { size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r1 = size * 0.50
  const r2 = size * 0.45
  const r3 = size * 0.44

  const topD    = `M ${cx - r2},${cy} A ${r2},${r2} 0 0,1 ${cx + r2},${cy}`
  const bottomD = `M ${cx - r1},${cy} A ${r1},${r1} 0 0,0 ${cx + r1},${cy}`

  const fs1  = Math.max(6,  Math.round(size * 0.115))
  const fs2  = Math.max(5,  Math.round(size * 0.09))
  const fsLY = Math.max(8,  Math.round(size * 0.24))
  const gw   = size * 0.19
  const gh   = size * 0.12
  const gry  = size * 0.05
  const mx   = cx
  const my   = cy + size * 0.06
  const mw   = size * 0.14
  const mh   = size * 0.07

  // Static IDs — no size suffix to avoid SSR/client mismatch
  const uid = `ly-${Math.round(size)}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Laaluyadav"
      style={{ flexShrink: 0 }}
      suppressHydrationWarning
    >
      <title>Laaluyadav</title>
      <defs>
        <path id={`ta-${uid}`} d={topD}    />
        <path id={`ba-${uid}`} d={bottomD} />
      </defs>

      <circle cx={cx} cy={cy} r={r1} fill="none" stroke="#E8001D" strokeWidth={size * 0.04} />
      <circle cx={cx} cy={cy} r={r2} fill="none" stroke="#FFE600" strokeWidth={size * 0.015} />
      <circle cx={cx} cy={cy} r={r3} fill="#0D0D0D" />

      <text fontFamily="'Bebas Neue', 'Arial Black', sans-serif" fontSize={fs1} fill="#FFE600" letterSpacing={size * 0.035}>
        <textPath href={`#ta-${uid}`} startOffset="7%">LAALUYADAV</textPath>
      </text>
      <text fontFamily="'Bebas Neue', 'Arial Black', sans-serif" fontSize={fs2} fill="#E8001D" letterSpacing={size * 0.018}>
        <textPath href={`#ba-${uid}`} startOffset="4%">UNEMPLOYABLE UNC</textPath>
      </text>

      <rect x={cx - gw - gw * 0.1} y={cy - size * 0.18} width={gw} height={gh} rx={gry}
        fill="none" stroke="#FFE600" strokeWidth={size * 0.028} />
      <rect x={cx + gw * 0.1} y={cy - size * 0.18} width={gw} height={gh} rx={gry}
        fill="none" stroke="#FFE600" strokeWidth={size * 0.028} />
      <line
        x1={cx - gw * 0.1} y1={cy - size * 0.18 + gh / 2}
        x2={cx + gw * 0.1} y2={cy - size * 0.18 + gh / 2}
        stroke="#FFE600" strokeWidth={size * 0.028} />
      <path
        d={`M ${cx - gw * 0.1},${cy - size * 0.18 + gh / 2} Q ${cx},${cy - size * 0.10} ${cx + gw * 0.1},${cy - size * 0.18 + gh / 2}`}
        fill="none" stroke="#FFE600" strokeWidth={size * 0.022} />

      <path d={`M ${mx},${my} Q ${mx - mw},${my - mh} ${mx - mw * 1.6},${my - mh * 0.4} Q ${mx - mw * 2.1},${my + mh * 0.2} ${mx - mw * 1.6},${my + mh * 0.6} Q ${mx - mw},${my + mh} ${mx},${my} Z`} fill="#FFE600" />
      <path d={`M ${mx},${my} Q ${mx + mw},${my - mh} ${mx + mw * 1.6},${my - mh * 0.4} Q ${mx + mw * 2.1},${my + mh * 0.2} ${mx + mw * 1.6},${my + mh * 0.6} Q ${mx + mw},${my + mh} ${mx},${my} Z`} fill="#FFE600" />

      <text x={cx} y={cy + size * 0.32}
        fontFamily="'Bebas Neue', 'Arial Black', sans-serif"
        fontSize={fsLY} fill="#FFE600" textAnchor="middle" letterSpacing={size * 0.02}>
        LY
      </text>

      <text x={cx} y={cy - r2 + fs1 * 1.8}
        fontFamily="sans-serif" fontSize={fs2} fill="#E8001D" textAnchor="middle">
        ★
      </text>
    </svg>
  )
}

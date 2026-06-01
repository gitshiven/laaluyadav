// Points to your deployed Vercel app's API route
// Update this after you deploy to Vercel
const API_URL = 'https://laaluyadav.vercel.app/api/movies'

const LAALU_LINES = [
  "Sunno, main duniya bhar ki movies dekh chuka hoon. Ye 5 — seedha dil se.",
  "Dekho bhai, ye koi random list nahi. Laalu ka full research hai iske peeche.",
  "Itni movies dekhi hain ki aankhen square ho gayi hain. Ye wale miss mat karna.",
  "Ye top 5 hai — pure janata ka full stamp of approval. Popcorn ready rakho.",
  "Main Bollywood bhi, Hollywood bhi, aur woh French wali subtitle wali bhi jaanta hoon.",
]

const LOADING_MSGS = [
  'LAALU IS THINKING VERY HARD...',
  'CROSS-REFERENCING WORLD CINEMA...',
  'CHECKING IMDB & POPCORNMETER...',
  'CALCULATING COMMUNITY SCORES...',
  'ALMOST THERE — LAALU IS FUSSY...',
]

const TASTE_STYLES = {
  'Action Masala':      'background:#E8001D;color:#fff',
  'Emotional Drama':    'background:#0D0D0D;color:#FFE600',
  'Dark Comedy':        'background:#FFE600;color:#0D0D0D',
  'Slow Burn Thriller': 'background:#222;color:#eee',
  'Romance':            'background:#e8004e;color:#fff',
  'Horror':             'background:#1a0000;color:#E8001D',
  'Arthouse':           'background:#f0e8d8;color:#0D0D0D',
  'Sci-Fi':             'background:#001aff;color:#fff',
  'World Cinema':       'background:#006400;color:#fff',
  'Feel-Good Comedy':   'background:#FFE600;color:#0D0D0D',
}

let msgInterval, progressInterval

function setProgress(pct, msg) {
  document.getElementById('progress').style.width = pct + '%'
  if (msg) document.getElementById('loadMsg').textContent = msg
}

function hideAll() {
  document.getElementById('loading').classList.remove('visible')
  document.getElementById('error').classList.remove('visible')
  document.getElementById('laalu').classList.remove('visible')
  document.getElementById('results').innerHTML = ''
}

async function search() {
  const query = document.getElementById('query').value.trim()
  const era   = document.getElementById('era').value
  if (!query) return

  hideAll()
  document.getElementById('btn').disabled = true
  document.getElementById('loading').classList.add('visible')
  setProgress(0)

  let idx = 0
  clearInterval(msgInterval)
  clearInterval(progressInterval)
  msgInterval = setInterval(() => {
    idx = (idx + 1) % LOADING_MSGS.length
    document.getElementById('loadMsg').textContent = LOADING_MSGS[idx]
  }, 2200)

  const steps = [15, 35, 55, 75, 90]
  let si = 0
  progressInterval = setInterval(() => {
    if (si < steps.length) setProgress(steps[si++])
  }, 1800)

  try {
    const res  = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, era }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Unknown error')

    clearInterval(msgInterval)
    clearInterval(progressInterval)
    setProgress(100)
    document.getElementById('loading').classList.remove('visible')

    const laalu = document.getElementById('laalu')
    document.getElementById('laalu-text').textContent = LAALU_LINES[Math.floor(Math.random() * LAALU_LINES.length)]
    laalu.classList.add('visible')

    renderMovies(data.results)

    // Cache last result
    chrome.storage.local.set({ lastResult: { results: data.results, query, era, ts: Date.now() } })

  } catch (e) {
    clearInterval(msgInterval)
    clearInterval(progressInterval)
    document.getElementById('loading').classList.remove('visible')
    document.getElementById('errorMsg').textContent = '🎬 ' + (e.message || 'Something broke. Dobara try karo!')
    document.getElementById('error').classList.add('visible')
  } finally {
    document.getElementById('btn').disabled = false
  }
}

function renderMovies(results) {
  const container = document.getElementById('results')
  container.innerHTML = '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;letter-spacing:0.05em;margin-bottom:0.5rem;">TOP PICKS</div>'

  results.forEach((m, i) => {
    const imdbPct      = ((parseFloat(m.imdb) || 0) / 10 * 100).toFixed(0)
    const popcornPct   = parseFloat(m.rtAudience || '0')
    const communityPct = Math.min(100, (m.communityScore / 10) * 100).toFixed(0)
    const tasteStyle   = TASTE_STYLES[m.taste] || 'background:#888;color:#fff'

    const card = document.createElement('div')
    card.className = 'movie'
    card.innerHTML = `
      <div class="movie-rank">${i + 1}</div>
      <div class="movie-body">
        <div>
          <span class="movie-title">${m.title}</span>
          ${m.year ? `<span class="movie-year">${m.year}</span>` : ''}
        </div>
        <span class="taste" style="${tasteStyle}">${m.taste || 'World Cinema'}</span>
        ${m.whyThisQuery ? `<p style="font-family:'Space Mono',monospace;font-size:0.58rem;color:#E8001D;font-style:italic;margin:0.3rem 0;line-height:1.4;">"${m.whyThisQuery}"</p>` : ''}
        <p class="movie-desc">${m.description}</p>
        <div class="meters">
          ${m.imdb && m.imdb !== 'N/A' ? meterHTML('IMDB', m.imdb, imdbPct, '#F5C518') : ''}
          ${m.rtAudience ? meterHTML('🍿 RT', m.rtAudience + '%', popcornPct, '#E8001D') : ''}
          ${meterHTML('Community', m.communityScore?.toFixed(1) + '/10', communityPct, '#0D0D0D')}
          ${m.finalScore ? meterHTML('⚡ Final', m.finalScore?.toFixed(1) + '/10', (m.finalScore/10)*100, '#FFE600') : ''}
        </div>
      </div>
      <div class="verdict">💬 ${m.verdict}</div>
    `
    container.appendChild(card)

    setTimeout(() => {
      card.querySelectorAll('.meter-fill[data-w]').forEach(bar => {
        bar.style.width = bar.getAttribute('data-w') + '%'
      })
    }, 300)
  })
}

function meterHTML(label, value, pct, color) {
  return `
    <div class="meter">
      <div class="meter-lbl">${label}</div>
      <div class="meter-val">${value}</div>
      <div class="meter-track"><div class="meter-fill" data-w="${pct}" style="background:${color};width:0;height:100%;transition:width 1s ease;"></div></div>
    </div>
  `
}

// Keyboard shortcut
document.getElementById('query').addEventListener('keydown', e => {
  if (e.key === 'Enter') search()
})

// Restore last result on open
chrome.storage.local.get('lastResult', ({ lastResult }) => {
  if (!lastResult) return
  const age = Date.now() - lastResult.ts
  if (age < 30 * 60 * 1000) { // 30 min cache
    document.getElementById('query').value = lastResult.query
    document.getElementById('era').value   = lastResult.era
    const laalu = document.getElementById('laalu')
    document.getElementById('laalu-text').textContent = LAALU_LINES[0]
    laalu.classList.add('visible')
    renderMovies(lastResult.results)
  }
})

document.getElementById('btn').addEventListener('click', search)

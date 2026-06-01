export const TASTE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Action Masala':      { bg: '#E8001D', text: '#fff',    border: '#E8001D' },
  'Emotional Drama':    { bg: '#0D0D0D', text: '#FFE600', border: '#0D0D0D' },
  'Dark Comedy':        { bg: '#FFE600', text: '#0D0D0D', border: '#0D0D0D' },
  'Slow Burn Thriller': { bg: '#222',    text: '#eee',    border: '#222'    },
  'Romance':            { bg: '#e8004e', text: '#fff',    border: '#e8004e' },
  'Horror':             { bg: '#1a0000', text: '#E8001D', border: '#E8001D' },
  'Arthouse':           { bg: '#f0e8d8', text: '#0D0D0D', border: '#0D0D0D' },
  'Sci-Fi':             { bg: '#001aff', text: '#fff',    border: '#001aff' },
  'World Cinema':       { bg: '#006400', text: '#fff',    border: '#006400' },
  'Feel-Good Comedy':   { bg: '#FF8C00', text: '#fff',    border: '#FF8C00' },
  'Crime & Mystery':    { bg: '#2D0054', text: '#fff',    border: '#2D0054' },
  'Docuseries':         { bg: '#003366', text: '#fff',    border: '#003366' },
  'Anthology':          { bg: '#4A0E4E', text: '#fff',    border: '#4A0E4E' },
  'Sitcom':             { bg: '#FF6B35', text: '#fff',    border: '#FF6B35' },
  'Miniseries':         { bg: '#1B4332', text: '#fff',    border: '#1B4332' },
}

export function getTasteStyle(taste: string) {
  return TASTE_STYLES[taste] ?? { bg: '#888', text: '#fff', border: '#888' }
}

export const MOVIE_SUBREDDITS = [
  'bollywood','BollywoodMemes','moviesuggestions','india','movies',
  'underratedmovies','HorrorMovies','TrueFilm','Letterboxd','horror',
  'boxoffice','IndianCinema','TeenIndia','criterion','okbuddycinephile',
  'wehatemovies','moviescirclejerk','boutiquebluray','blankies',
]

export const TV_SUBREDDITS = [
  'televisionsuggestions','tvshow','community','television','TvShows',
  'sitcoms','tvPlus','Netflixwatch','hbo','BritishTV',
  'bestofnetflix','indiasocial','IndianOTTbestof','IndianTellyTalk','funnyIndia',
]

export const LOADING_MSGS = [
  'LAALU IS ASKING MRS YADAV FOR YOUR ANSWER...',
  'READING THE ROOM...',
  'SEPARATING HYPE FROM TRUTH...',
  'ONE LAALU IS DISAPPOINTING, THIS ONE IS NOT HIM...',
  'CHECKING REWATCH BEHAVIOUR...',
  'DIGGING INTO THE COMMUNITY SENTIMENT...',
  'ALMOST THERE — LAALU IS FUSSY...',
  'BADE BHAI CLAUDE IS THINKING...',
  'SCRAPING CHALRI HAI BHAYANKAR...'
]

export function getLaaluLine(count: number): string {
  if (count === 1) {
    const lines = [
      "Bhai ek hi chahiye tha? Le, ye dekh. Koi argument nahi.",
      "Seedha point pe aaya. Ek hi best hai — ye raha.",
      "Ek pick. Laalu ki personal guarantee. Mat miss karna.",
      "Ek hi answer? Theek hai. Ye wala. Full stop.",
    ]
    return lines[Math.floor(Math.random() * lines.length)]
  }
  const lines = [
    `Bhai, ye rahi teri ${count} picks — seedha dil se, koi compromise nahi.`,
    `${count} recommendations nikale hain. Laalu ne personally screen kiya hai har ek ko.`,
    `Dekho, ${count} options hain. Sab dekhe toh life set, warna tum jaano.`,
    `Itni research ke baad ${count} picks — agar pasand nahi aaye toh taste fix karo pehle.`,
    `${count} films/shows — ordered best to worst. Number one se shuru karo, bakwaas mat karo.`,
  ]
  return lines[Math.floor(Math.random() * lines.length)]
}

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
export type BuzzIndex = 'Insane' | 'Very High' | 'High' | 'Decent'
export type ContentType = 'movie' | 'show' | 'both'

export type TasteTag =
  | 'Action Masala' | 'Emotional Drama' | 'Dark Comedy'
  | 'Slow Burn Thriller' | 'Romance' | 'Horror' | 'Arthouse'
  | 'Sci-Fi' | 'World Cinema' | 'Feel-Good Comedy'
  | 'Crime & Mystery' | 'Docuseries' | 'Anthology' | 'Sitcom' | 'Miniseries'

export interface EmotionalDNA  { tags: string[] }
export interface WhoIsThisFor  { watch: string; skip: string }
export interface LaaluDissent  { type: 'overhyped' | 'underseen'; quote: string }
export interface GatewayInfo   { into: string }

export interface Result {
  title: string
  year: string
  type: 'Movie' | 'TV Show' | 'Mini-Series' | 'Docuseries'
  seasons?: string
  taste: TasteTag
  description: string
  whyThisQuery?: string
  imdb: string
  imdbVotes?: string
  rtAudience?: string
  tmdbScore?: string
  tmdbVotes?: number
  poster?: string
  backdrop?: string
  genre?: string
  runtime?: string
  awards?: string
  communityScore: number
  rewatchIndex: number
  regretScore: number
  buzzIndex: BuzzIndex
  finalScore: number
  emotionalDNA: EmotionalDNA
  whoIsThisFor: WhoIsThisFor
  verdict: string
  dissent?: LaaluDissent
  gateway?: GatewayInfo
}

export interface ChatMessage {
  role: 'user' | 'laalu'
  text: string
}

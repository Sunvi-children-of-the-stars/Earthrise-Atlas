/** English dictionary (default language). Same keys as fr.ts. No em dash, no italics. */
export const en = {
  "brand": "Earthrise Atlas",
  "nav.story": "Story",
  "nav.atlas": "Atlas",
  "nav.play": "Play",
  "nav.lab": "Mission Lab",
  "nav.method": "Method",
  "nav.menu": "Menu",
  "nav.lang": "Language",
  "nav.skip": "Skip to content",
  "page.story": "Story",
  "page.atlas": "Atlas",
  "page.play": "Play",
  "page.lab": "Mission Lab",
  "page.method": "Method",
  "common.loading": "Loading",
  "common.error": "Something went wrong while loading the data.",
  "footer.challenge": "Built for the NASA Space Apps Challenge 2026, Lunar Landing Site Navigator.",
  "footer.data": "Data: NASA LRO (LOLA, LROC, Diviner), JPL Horizons. All times in UTC.",
} as const;

export type MessageKey = keyof typeof en;

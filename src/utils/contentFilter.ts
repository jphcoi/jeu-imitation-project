const BANNED_PATTERNS = [
  /\bconnasse\b/i,
  /\bconnard\b/i,
  /\bcon\b/i,
  /\bsa\s*m[eè]re\b/i,
  /\bta\s*m[eè]re\b/i,
  /\bfdp\b/i,
  /\btchouin\b/i,
  /\bva\s*te\s*faire\s*foutre\b/i,
  /\bvtff\b/i,
  /\benculer?\b/i,
  /\bencul[eé][e]?s?\b/i,
  /\bbranler?\b/i,
  /\bbranleur\b/i,
  /\bbranlette\b/i,
  /\bbaiser\b/i,
  /\bd[eé]foncer?\b/i,
  /\bd[eé]fonc[eé][e]?s?\b/i,
  /\bnique\b/i,
  /\bniquer?\b/i,
  /\bniqu[eé][e]?s?\b/i,
  /\bsalope\b/i,
  /\bb[aâ]tard\b/i,
  /\bputain\b/i,
  /\bmerde\b/i,
];

export function containsBannedWords(text: string): boolean {
  return BANNED_PATTERNS.some(p => p.test(text));
}

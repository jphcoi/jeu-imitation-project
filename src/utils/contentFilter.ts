// Normalise before matching: strip accents, collapse repeated letters, lowercase
function normalise(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/€/g, 'e')                                // € used as e bypass (encul€)
    .replace(/(.)\1{1,}/g, '$1')                       // collapse repeated chars (connnnard → conard)
    .toLowerCase();
}

// Patterns run against the NORMALISED string (no accents, no repeated chars, lowercase)
const BANNED_PATTERNS = [
  // con, cons, conne, connes — also k-variants (kon, konne…)
  /\b[ck]onn?e?s?\b/,

  // connard(e)(s), connar — also k-variants
  /\b[ck]onn?ar[d]?e?s?\b/,

  // connasse(s) — also k-variants
  /\b[ck]onn?ass?e?s?\b/,

  // sa/ta mere (accent already stripped by normalise)
  /\b[st]a\s*mere\b/,

  // fdp, f.d.p
  /\bf\.?d\.?p\b/,

  // tchouin, tchoin, tchouins, tchoins, tchouins
  /\btch(?:ou)?ins?\b/,

  // va te faire foutre, vtff
  /\bva\s*te\s*faire\s*foutre\b/,
  /\bvtff\b/,

  // enculer, enculé(e)(s), enculeur(s) — also enkul- variants
  /\ben[ck]ul(?:er?|e[eurs]?e?s?)\b/,

  // branler, branlé(e)(s), branleur(se)(s), branlette(s)
  /\bbranl(?:er?|e(?:ur?|use?|tte?|e)?s?)\b/,

  // baiser, baisé(e)(s), baiseur(se)(s)
  /\bbais(?:er?|e[eurs]?e?s?)\b/,

  // defoncer, defonce(e)(s) (accent stripped)
  /\bdefonc(?:er?|ee?s?)\b/,

  // nique, niquer, niqué(e)(s) — also nik- variants
  /\bni[kq]u?(?:er?|ee?s?)\b/,

  // salope(s), salopard(e)(s)
  /\bsalop(?:es?|ard?e?s?)\b/,

  // batard(e)(s) (accent stripped by normalise)
  /\bbatar[d]?e?s?\b/,

  // putain(s)
  /\bputains?\b/,

  // pute(s), putas
  /\bputas?\b/,
  /\bputes?\b/,

  // merde(s), merdique(s), merdeux/merdeuse(s)
  /\bmerdes?\b/,
  /\bmerdiqu?e?s?\b/,
  /\bmerdeu[xs]e?s?\b/,
];

export function containsBannedWords(text: string): boolean {
  const n = normalise(text);
  return BANNED_PATTERNS.some(p => p.test(n));
}

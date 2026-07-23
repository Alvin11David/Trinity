import type { Country } from '../api/countries';

// API-Football's flag images are all .svg -- React Native's core Image
// component can't render remote SVGs (confirmed: media.api-sports.io only
// serves .svg, no .png alternate at the same path). flagcdn.com is a
// well-established public flag CDN; we build its URL from the ISO code
// already synced from API-Football's own /countries endpoint, so this is a
// deliberate third-party image host, not a data source change.
function buildFlagUrl(code: string): string {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

// Drops Unicode combining diacritical marks (U+0300-U+036F) left behind by
// NFD decomposition, e.g. turns the two code points behind an accented "u"
// into a plain "u". Uses numeric code-point comparison rather than a regex
// character class to avoid embedding literal special characters in source.
function stripCombiningMarks(str: string): string {
  return Array.from(str)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join('');
}

function normalize(name: string): string {
  const decomposed = stripCombiningMarks(name.normalize('NFD'));
  return decomposed
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z ]/g, '') // drop apostrophes/punctuation, keep letters + spaces only
    .replace(/\s+/g, ' ')
    .trim();
}

// API-Football's /players, /leagues, and /countries endpoints don't always
// agree on naming -- confirmed empirically by cross-checking real synced
// player nationalities AND League.country_name values against the synced
// Country table. Hyphen and accent differences are handled by normalize()
// above; these are the remaining genuine name mismatches found so far.
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  czechia: 'czech republic',
  'korea republic': 'south korea',
  turkiye: 'turkey',
  'cote divoire': 'ivory coast',
  uae: 'united arab emirates',
  'republic of ireland': 'ireland',
};

export function getFlagUrl(
  countryOrNationality: string | null | undefined,
  countries: Country[] | undefined
): string | null {
  if (!countryOrNationality || !countries || countries.length === 0) return null;

  const normalized = normalize(countryOrNationality);
  const target = COUNTRY_NAME_ALIASES[normalized] ?? normalized;

  const match = countries.find((c) => normalize(c.name) === target);
  if (!match?.code) return null;

  return buildFlagUrl(match.code);
}

// Real primary shirt/brand colors for clubs across the 5 synced core
// leagues. Keys are verified against the exact `home_team`/`away_team`
// strings API-Football returns in our own DB (checked directly, not
// guessed) — API-Football's naming doesn't always match a club's common
// name (e.g. "Inter" not "Inter Milan", "AS Roma" not "Roma", "Tottenham"
// not "Tottenham Hotspur"). Anything not in this map (lower leagues,
// non-core competitions, future teams) falls back to a deterministic
// hash-based color so the feature never breaks, it just loses real-brand
// accuracy for less common teams.
const KNOWN_TEAM_COLORS: Record<string, string> = {
  // Premier League
  Liverpool: '#C8102E',
  'Manchester City': '#6CABDD',
  'Manchester United': '#DA291C',
  Arsenal: '#EF0107',
  Chelsea: '#034694',
  Tottenham: '#132257',
  Newcastle: '#241F20',
  'Aston Villa': '#670E36',
  Brighton: '#0057B8',
  'West Ham': '#7A263A',
  Everton: '#003399',
  Wolves: '#FDB913',
  Fulham: '#000000',
  Brentford: '#E30613',
  'Crystal Palace': '#1B458F',
  'Nottingham Forest': '#DD0000',
  Bournemouth: '#B50E12',
  Burnley: '#6C1D45',
  Leeds: '#FFCD00',
  Sunderland: '#EB172B',

  // La Liga
  'Real Madrid': '#FEBE10',
  Barcelona: '#A50044',
  'Atletico Madrid': '#CB3524',
  Sevilla: '#D8112C',
  'Real Sociedad': '#0067B1',
  Villarreal: '#FFE667',
  'Athletic Club': '#EE2523',
  'Real Betis': '#00954C',
  Valencia: '#EE3524',
  Espanyol: '#003778',
  'Celta Vigo': '#8AC3EE',
  Getafe: '#005999',
  Girona: '#CD2534',
  Osasuna: '#D2011F',
  'Rayo Vallecano': '#E81E2B',
  Mallorca: '#CB1121',

  // Serie A
  Juventus: '#000000',
  Inter: '#010E80',
  'AC Milan': '#FB090B',
  Napoli: '#12A0D7',
  'AS Roma': '#8E1F2F',
  Lazio: '#87D8F7',
  Atalanta: '#1E71B8',
  Fiorentina: '#482E92',
  Bologna: '#A61B2B',
  Torino: '#881D22',
  Udinese: '#000000',
  Sassuolo: '#00A650',

  // Bundesliga
  'Bayern München': '#DC052D',
  'Borussia Dortmund': '#FDE100',
  'RB Leipzig': '#DD0741',
  'Bayer Leverkusen': '#E32219',
  'Eintracht Frankfurt': '#E1000F',
  'Borussia Mönchengladbach': '#000000',
  'VfB Stuttgart': '#E32219',
  'SC Freiburg': '#000000',
  'Werder Bremen': '#1D9053',
  '1899 Hoffenheim': '#1C63B7',
  'FC Augsburg': '#BA3733',
  'Union Berlin': '#EB1923',
  '1. FC Köln': '#ED1C24',

  // Ligue 1
  'Paris Saint Germain': '#004170',
  Marseille: '#2FAEE0',
  Lyon: '#DA1F27',
  Monaco: '#E7192C',
  Lille: '#D2001F',
  Lens: '#FFD200',
  Rennes: '#E2001A',
  Nice: '#D2001F',
  Nantes: '#FFCC00',
  Strasbourg: '#0072CE',
};

const FALLBACK_PALETTE = ['#1B9C5D', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getTeamColor(teamName: string): string {
  const known = KNOWN_TEAM_COLORS[teamName];
  if (known) return known;
  return FALLBACK_PALETTE[hashString(teamName) % FALLBACK_PALETTE.length];
}

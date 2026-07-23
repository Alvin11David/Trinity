// Mock data that mirrors the Django API models
// Replace API calls with real endpoints when backend is running

export const CURRENT_USER = {
  id: 1,
  username: 'marcus_fw',
  first_name: 'Marcus',
  last_name: 'Owusu',
  bio: 'Football obsessive. Premier League watcher. Stats nerd. ⚽',
  avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=marcus&backgroundColor=b6e3f4',
  banner: null,
  favorite_club: 'Arsenal',
  followers_count: 1482,
  following_count: 304,
  posts_count: 237,
}

export const USERS = [
  { id: 2, username: 'talia_fc', first_name: 'Talia', last_name: 'Sörensen', bio: 'Barcelona faithful 🔵🔴', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=talia', followers_count: 892, following_count: 201 },
  { id: 3, username: 'joel_prem', first_name: 'Joel', last_name: 'Mbeki', bio: 'Liverpool till I die 🔴', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=joel', followers_count: 3412, following_count: 512 },
  { id: 4, username: 'winnie_ai', first_name: 'Winnie', last_name: 'AI', bio: 'Your AI football analyst 🤖', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=winnie&backgroundColor=d1d4f9', followers_count: 12900, following_count: 0 },
  { id: 5, username: 'chioma_bvb', first_name: 'Chioma', last_name: 'Eze', bio: 'BVB forever 🟡⚫', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=chioma', followers_count: 670, following_count: 190 },
]

export const TEAMS = [
  { api_football_id: 42, name: 'Arsenal', code: 'ARS', country: 'England', logo: 'https://media.api-sports.io/football/teams/42.png', venue_name: 'Emirates Stadium', venue_city: 'London', venue_capacity: 60704, squad_value_eur: 850000000 },
  { api_football_id: 40, name: 'Liverpool', code: 'LIV', country: 'England', logo: 'https://media.api-sports.io/football/teams/40.png', venue_name: 'Anfield', venue_city: 'Liverpool', venue_capacity: 53394, squad_value_eur: 920000000 },
  { api_football_id: 50, name: 'Manchester City', code: 'MCI', country: 'England', logo: 'https://media.api-sports.io/football/teams/50.png', venue_name: 'Etihad Stadium', venue_city: 'Manchester', venue_capacity: 53400, squad_value_eur: 1100000000 },
  { api_football_id: 33, name: 'Manchester United', code: 'MUN', country: 'England', logo: 'https://media.api-sports.io/football/teams/33.png', venue_name: 'Old Trafford', venue_city: 'Manchester', venue_capacity: 74310, squad_value_eur: 620000000 },
  { api_football_id: 49, name: 'Chelsea', code: 'CHE', country: 'England', logo: 'https://media.api-sports.io/football/teams/49.png', venue_name: 'Stamford Bridge', venue_city: 'London', venue_capacity: 40853, squad_value_eur: 780000000 },
  { api_football_id: 47, name: 'Tottenham', code: 'TOT', country: 'England', logo: 'https://media.api-sports.io/football/teams/47.png', venue_name: 'Tottenham Hotspur Stadium', venue_city: 'London', venue_capacity: 62850, squad_value_eur: 540000000 },
  { api_football_id: 529, name: 'Barcelona', code: 'BAR', country: 'Spain', logo: 'https://media.api-sports.io/football/teams/529.png', venue_name: 'Camp Nou', venue_city: 'Barcelona', venue_capacity: 99354, squad_value_eur: 980000000 },
  { api_football_id: 541, name: 'Real Madrid', code: 'REA', country: 'Spain', logo: 'https://media.api-sports.io/football/teams/541.png', venue_name: 'Santiago Bernabéu', venue_city: 'Madrid', venue_capacity: 81044, squad_value_eur: 1050000000 },
  { api_football_id: 157, name: 'Bayern Munich', code: 'BAY', country: 'Germany', logo: 'https://media.api-sports.io/football/teams/157.png', venue_name: 'Allianz Arena', venue_city: 'Munich', venue_capacity: 75024, squad_value_eur: 890000000 },
  { api_football_id: 165, name: 'Borussia Dortmund', code: 'BVB', country: 'Germany', logo: 'https://media.api-sports.io/football/teams/165.png', venue_name: 'Signal Iduna Park', venue_city: 'Dortmund', venue_capacity: 81365, squad_value_eur: 450000000 },
]

const teamById = (id) => TEAMS.find(t => t.api_football_id === id) || TEAMS[0]

export const MATCHES = [
  {
    id: 1, api_football_id: 1001001,
    home_team: teamById(42), away_team: teamById(40),
    home_score: 2, away_score: 1,
    status: 'live', minute: 67,
    league_name: 'Premier League', league_id: 39, season: 2025,
    kickoff_time: new Date(Date.now() - 67 * 60 * 1000).toISOString(),
    venue_name: 'Emirates Stadium', venue_city: 'London',
    events: [
      { id: 1, event_type: 'goal', player: 'Saka', minute: 14, team: teamById(42), detail: 'Normal Goal', assist_player: 'Ødegaard' },
      { id: 2, event_type: 'yellow_card', player: 'Salah', minute: 31, team: teamById(40), detail: 'Foul' },
      { id: 3, event_type: 'goal', player: 'Havertz', minute: 52, team: teamById(42), detail: 'Header', assist_player: 'White' },
      { id: 4, event_type: 'goal', player: 'Nunez', minute: 61, team: teamById(40), detail: 'Normal Goal', assist_player: 'Salah' },
    ],
    winnie_prediction: { home_win: 54, draw: 22, away_win: 24 },
  },
  {
    id: 2, api_football_id: 1001002,
    home_team: teamById(50), away_team: teamById(49),
    home_score: null, away_score: null,
    status: 'scheduled', minute: null,
    league_name: 'Premier League', league_id: 39, season: 2025,
    kickoff_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    venue_name: 'Etihad Stadium', venue_city: 'Manchester',
    events: [],
    winnie_prediction: { home_win: 62, draw: 18, away_win: 20 },
  },
  {
    id: 3, api_football_id: 1001003,
    home_team: teamById(529), away_team: teamById(541),
    home_score: 3, away_score: 2,
    status: 'finished', minute: 90,
    league_name: 'La Liga', league_id: 140, season: 2025,
    kickoff_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    venue_name: 'Camp Nou', venue_city: 'Barcelona',
    events: [
      { id: 5, event_type: 'goal', player: 'Yamal', minute: 8, team: teamById(529), detail: 'Normal Goal', assist_player: 'Raphinha' },
      { id: 6, event_type: 'goal', player: 'Mbappé', minute: 23, team: teamById(541), detail: 'Penalty', assist_player: null },
      { id: 7, event_type: 'goal', player: 'Lewandowski', minute: 44, team: teamById(529), detail: 'Header', assist_player: 'Dani Olmo' },
      { id: 8, event_type: 'goal', player: 'Bellingham', minute: 58, team: teamById(541), detail: 'Normal Goal', assist_player: 'Valverde' },
      { id: 9, event_type: 'red_card', player: 'Militão', minute: 74, team: teamById(541), detail: 'Second Yellow' },
      { id: 10, event_type: 'goal', player: 'Raphinha', minute: 88, team: teamById(529), detail: 'Free Kick', assist_player: null },
    ],
    winnie_prediction: { home_win: 48, draw: 24, away_win: 28 },
  },
  {
    id: 4, api_football_id: 1001004,
    home_team: teamById(157), away_team: teamById(165),
    home_score: 1, away_score: 1,
    status: 'finished', minute: 90,
    league_name: 'Bundesliga', league_id: 78, season: 2025,
    kickoff_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    venue_name: 'Allianz Arena', venue_city: 'Munich',
    events: [
      { id: 11, event_type: 'goal', player: 'Kane', minute: 27, team: teamById(157), detail: 'Normal Goal', assist_player: 'Müller' },
      { id: 12, event_type: 'goal', player: 'Adeyemi', minute: 83, team: teamById(165), detail: 'Counter Attack', assist_player: null },
    ],
    winnie_prediction: { home_win: 58, draw: 21, away_win: 21 },
  },
  {
    id: 5, api_football_id: 1001005,
    home_team: teamById(33), away_team: teamById(47),
    home_score: null, away_score: null,
    status: 'scheduled', minute: null,
    league_name: 'Premier League', league_id: 39, season: 2025,
    kickoff_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    venue_name: 'Old Trafford', venue_city: 'Manchester',
    events: [],
    winnie_prediction: { home_win: 40, draw: 28, away_win: 32 },
  },
]

export const STANDINGS = [
  { rank: 1, team: teamById(40), played: 30, win: 21, draw: 6, lose: 3, goals_for: 71, goals_against: 30, goals_diff: 41, points: 69, form: 'WWWDW' },
  { rank: 2, team: teamById(42), played: 30, win: 20, draw: 5, lose: 5, goals_for: 68, goals_against: 35, goals_diff: 33, points: 65, form: 'WWWLW' },
  { rank: 3, team: teamById(50), played: 30, win: 18, draw: 7, lose: 5, goals_for: 63, goals_against: 32, goals_diff: 31, points: 61, form: 'WDWWL' },
  { rank: 4, team: teamById(47), played: 30, win: 16, draw: 6, lose: 8, goals_for: 54, goals_against: 42, goals_diff: 12, points: 54, form: 'LWWDW' },
  { rank: 5, team: teamById(49), played: 30, win: 15, draw: 5, lose: 10, goals_for: 52, goals_against: 44, goals_diff: 8, points: 50, form: 'WLDWW' },
  { rank: 6, team: teamById(33), played: 30, win: 13, draw: 7, lose: 10, goals_for: 46, goals_against: 47, goals_diff: -1, points: 46, form: 'LLDWW' },
]

export const PLAYERS = [
  { id: 1, api_football_id: 276, name: 'Neymar Jr.', first_name: 'Neymar', last_name: 'Jr.', age: 33, position: 'Attacker', number: 10, nationality: 'Brazil', height: '175 cm', weight: '68 kg', photo: 'https://media.api-sports.io/football/players/276.png', team: teamById(529), market_value_eur: 25000000, preferred_foot: 'right', injured: false },
  { id: 2, api_football_id: 874, name: 'Mohamed Salah', first_name: 'Mohamed', last_name: 'Salah', age: 32, position: 'Attacker', number: 11, nationality: 'Egypt', height: '175 cm', weight: '71 kg', photo: 'https://media.api-sports.io/football/players/874.png', team: teamById(40), market_value_eur: 65000000, preferred_foot: 'left', injured: false },
  { id: 3, api_football_id: 521, name: 'Erling Haaland', first_name: 'Erling', last_name: 'Haaland', age: 24, position: 'Attacker', number: 9, nationality: 'Norway', height: '194 cm', weight: '88 kg', photo: 'https://media.api-sports.io/football/players/521.png', team: teamById(50), market_value_eur: 180000000, preferred_foot: 'left', injured: false },
  { id: 4, api_football_id: 19, name: 'Kylian Mbappé', first_name: 'Kylian', last_name: 'Mbappé', age: 26, position: 'Attacker', number: 9, nationality: 'France', height: '178 cm', weight: '73 kg', photo: 'https://media.api-sports.io/football/players/19.png', team: teamById(541), market_value_eur: 200000000, preferred_foot: 'right', injured: false },
  { id: 5, api_football_id: 184, name: 'Bukayo Saka', first_name: 'Bukayo', last_name: 'Saka', age: 23, position: 'Attacker', number: 7, nationality: 'England', height: '178 cm', weight: '72 kg', photo: 'https://media.api-sports.io/football/players/184.png', team: teamById(42), market_value_eur: 150000000, preferred_foot: 'left', injured: false },
  { id: 6, api_football_id: 2295, name: 'Harry Kane', first_name: 'Harry', last_name: 'Kane', age: 31, position: 'Attacker', number: 9, nationality: 'England', height: '188 cm', weight: '86 kg', photo: 'https://media.api-sports.io/football/players/2295.png', team: teamById(157), market_value_eur: 90000000, preferred_foot: 'right', injured: false },
  { id: 7, api_football_id: 909, name: 'Jude Bellingham', first_name: 'Jude', last_name: 'Bellingham', age: 21, position: 'Midfielder', number: 5, nationality: 'England', height: '186 cm', weight: '83 kg', photo: 'https://media.api-sports.io/football/players/909.png', team: teamById(541), market_value_eur: 180000000, preferred_foot: 'right', injured: false },
  { id: 8, api_football_id: 47, name: 'Robert Lewandowski', first_name: 'Robert', last_name: 'Lewandowski', age: 36, position: 'Attacker', number: 9, nationality: 'Poland', height: '185 cm', weight: '81 kg', photo: 'https://media.api-sports.io/football/players/47.png', team: teamById(529), market_value_eur: 18000000, preferred_foot: 'right', injured: false },
]

export const POSTS = [
  {
    id: 1, post_type: 'text',
    author: USERS[0],
    content: 'Saka is absolutely unreal tonight. Two assists and a goal threat every time he gets the ball. Generational talent. 🔥',
    reactions: { goal: 142, hot_take: 12, smart: 89, terrible: 3 },
    comments_count: 34,
    reposts_count: 28,
    user_reaction: null,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    media: [],
  },
  {
    id: 2, post_type: 'winnie_insight',
    author: USERS[3],
    content: '📊 Arsenal are pressing at 78.4 PPDA tonight — their most intense press of the season. Liverpool are struggling to play out from the back. Expect more turnovers in the second half.',
    reactions: { goal: 87, hot_take: 6, smart: 201, terrible: 1 },
    comments_count: 19,
    reposts_count: 56,
    user_reaction: 'smart',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    media: [],
  },
  {
    id: 3, post_type: 'match_object',
    author: USERS[1],
    content: 'What a match! Barcelona edge out Real Madrid in an El Clásico thriller 🔥',
    match: MATCHES[2],
    reactions: { goal: 523, hot_take: 31, smart: 144, terrible: 8 },
    comments_count: 128,
    reposts_count: 219,
    user_reaction: 'goal',
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    media: [],
  },
  {
    id: 4, post_type: 'text',
    author: USERS[2],
    content: 'Hot take: Jude Bellingham is already better than any English midfielder in Premier League history at his age. Yes, including Gerrard at 21. Fight me.',
    reactions: { goal: 34, hot_take: 312, smart: 56, terrible: 98 },
    comments_count: 287,
    reposts_count: 89,
    user_reaction: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    media: [],
  },
  {
    id: 5, post_type: 'text',
    author: USERS[4],
    content: 'Haaland just CANNOT stop scoring. 24 years old with 156 career goals in club football. Absolutely absurd numbers. 🥶',
    reactions: { goal: 891, hot_take: 22, smart: 334, terrible: 5 },
    comments_count: 74,
    reposts_count: 341,
    user_reaction: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    media: [],
  },
]

export const COMMUNITIES = [
  { id: 1, name: 'Premier League Central', description: 'The home for all Premier League discussion, analysis, and banter.', avatar: 'https://media.api-sports.io/football/leagues/39.png', is_official: true, members_count: 45200, posts_count: 12400 },
  { id: 2, name: 'La Liga Fans', description: 'Spanish football at its finest. Discuss all things La Liga.', avatar: 'https://media.api-sports.io/football/leagues/140.png', is_official: true, members_count: 32100, posts_count: 8900 },
  { id: 3, name: 'Bundesliga HQ', description: 'The fastest league in the world. Join the Bundesliga conversation.', avatar: 'https://media.api-sports.io/football/leagues/78.png', is_official: false, members_count: 18700, posts_count: 5600 },
  { id: 4, name: 'Transfer Rumours & News', description: 'Latest transfer gossip, confirmed signings, and windows speculation.', avatar: null, is_official: false, members_count: 62400, posts_count: 31200 },
  { id: 5, name: 'Tactical Analysis', description: 'Deep dives into formations, pressing systems, and matchday tactics.', avatar: null, is_official: false, members_count: 9800, posts_count: 3400 },
  { id: 6, name: 'Arsenal FC', description: 'Official Arsenal community on Ball. COYG! 🔴⚪', avatar: 'https://media.api-sports.io/football/teams/42.png', is_official: true, members_count: 28900, posts_count: 14100 },
]

export const NOTIFICATIONS = [
  { id: 1, notification_type: 'goal', title: 'GOAL! Arsenal 1-0 Liverpool', body: 'Bukayo Saka scores in the 14th minute!', is_read: false, created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(), sender: null },
  { id: 2, notification_type: 'follow', title: 'New Follower', body: 'joel_prem started following you.', is_read: false, created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(), sender: USERS[2] },
  { id: 3, notification_type: 'reaction', title: 'Reaction on your post', body: 'talia_fc reacted ⚽ Goal to your post.', is_read: false, created_at: new Date(Date.now() - 34 * 60 * 1000).toISOString(), sender: USERS[1] },
  { id: 4, notification_type: 'reply', title: 'Reply to your post', body: 'joel_prem replied: "Saka is carrying them tonight ngl"', is_read: true, created_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(), sender: USERS[2] },
  { id: 5, notification_type: 'kickoff', title: 'Kickoff in 15 min', body: 'Arsenal vs Liverpool is about to begin!', is_read: true, created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), sender: null },
  { id: 6, notification_type: 'winnie_alert', title: 'Winnie Insight', body: 'Arsenal are dominating possession — 68% with 8 shots on target.', is_read: true, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), sender: null },
  { id: 7, notification_type: 'community_post', title: 'New post in Premier League Central', body: 'Check out the latest match analysis from winnie_ai', is_read: true, created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), sender: USERS[3] },
]

export const CONVERSATIONS = [
  {
    id: 1, conversation_type: 'direct',
    name: null,
    participants: [USERS[0], USERS[2]],
    other_user: USERS[2],
    last_message: { content: 'Did you see that Saka goal?? 🔥', created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
    unread_count: 2,
    messages: [
      { id: 1, sender: USERS[2], content: 'Watching the Arsenal match?', created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString() },
      { id: 2, sender: CURRENT_USER, content: 'Yeah! So intense', created_at: new Date(Date.now() - 68 * 60 * 1000).toISOString() },
      { id: 3, sender: USERS[2], content: 'Did you see that Saka goal?? 🔥', created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 2, conversation_type: 'group',
    name: 'Premier League Watchparty',
    participants: [USERS[0], USERS[1], USERS[2], USERS[4]],
    other_user: null,
    last_message: { content: 'CLASICO TOMORROW LADS', created_at: new Date(Date.now() - 22 * 60 * 1000).toISOString() },
    unread_count: 5,
    messages: [
      { id: 4, sender: USERS[1], content: 'Who\'s watching the Clasico tomorrow?', created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      { id: 5, sender: USERS[4], content: 'CLASICO TOMORROW LADS', created_at: new Date(Date.now() - 22 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 3, conversation_type: 'direct',
    name: null,
    participants: [USERS[0], USERS[1]],
    other_user: USERS[1],
    last_message: { content: 'Lewandowski hat trick incoming 🔮', created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    unread_count: 0,
    messages: [
      { id: 6, sender: USERS[1], content: 'Lewandowski hat trick incoming 🔮', created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    ],
  },
]

export function formatTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatKickoff(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diff = date - now
  if (diff < 0) return null
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function formatValue(eur) {
  if (!eur) return '—'
  if (eur >= 1e9) return `€${(eur / 1e9).toFixed(1)}B`
  if (eur >= 1e6) return `€${(eur / 1e6).toFixed(0)}M`
  return `€${eur.toLocaleString()}`
}

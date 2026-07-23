import { useState } from 'react'
import { Star, TrendingUp, Award } from 'lucide-react'
import { STANDINGS, PLAYERS } from '../utils/mock'
import clsx from 'clsx'

const LEAGUES_LIST = [
  { id: 39, name: 'Premier League', logo: 'https://media.api-sports.io/football/leagues/39.png', country: 'England' },
  { id: 140, name: 'La Liga', logo: 'https://media.api-sports.io/football/leagues/140.png', country: 'Spain' },
  { id: 78, name: 'Bundesliga', logo: 'https://media.api-sports.io/football/leagues/78.png', country: 'Germany' },
  { id: 135, name: 'Serie A', logo: 'https://media.api-sports.io/football/leagues/135.png', country: 'Italy' },
  { id: 61, name: 'Ligue 1', logo: 'https://media.api-sports.io/football/leagues/61.png', country: 'France' },
]

const TABS = ['Standings', 'Top Scorers', 'Assists']

function FormCell({ form }) {
  if (!form) return null
  return (
    <div className="flex gap-0.5">
      {form.split('').map((c, i) => (
        <span key={i} className={clsx('w-4 h-4 rounded-sm text-white text-[9px] font-bold flex items-center justify-center',
          c === 'W' ? 'bg-green-500' : c === 'D' ? 'bg-gray-400' : 'bg-red-500'
        )}>
          {c}
        </span>
      ))}
    </div>
  )
}

export default function Leagues() {
  const [selectedLeague, setSelectedLeague] = useState(LEAGUES_LIST[0])
  const [activeTab, setActiveTab] = useState(0)
  const [followed, setFollowed] = useState(new Set([39]))

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>Leagues</h1>
        <p className="text-sm text-muted">Standings, top scorers, and more.</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* League list */}
        <div className="lg:w-56 shrink-0">
          <div className="card overflow-hidden">
            {LEAGUES_LIST.map((league, i) => (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                  i < LEAGUES_LIST.length - 1 && 'border-b',
                  selectedLeague.id === league.id
                    ? 'bg-green-50 dark:bg-green-950/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
                style={{ borderColor: 'var(--border)' }}
              >
                <img src={league.logo} alt={league.name} className="w-7 h-7 object-contain" onError={e => e.target.style.display='none'} />
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm font-semibold truncate', selectedLeague.id === league.id ? 'text-green-600 dark:text-green-400' : '')} style={{ color: selectedLeague.id === league.id ? undefined : 'var(--text)' }}>
                    {league.name}
                  </p>
                  <p className="text-xs text-muted">{league.country}</p>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setFollowed(f => {
                      const n = new Set(f)
                      n.has(league.id) ? n.delete(league.id) : n.add(league.id)
                      return n
                    })
                  }}
                  className={clsx('shrink-0', followed.has(league.id) ? 'text-green-500' : 'text-muted hover:text-green-500')}
                >
                  <Star size={15} fill={followed.has(league.id) ? 'currentColor' : 'none'} />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {/* League header */}
          <div className="flex items-center gap-3 mb-4">
            <img src={selectedLeague.logo} alt={selectedLeague.name} className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{selectedLeague.name}</h2>
              <p className="text-xs text-muted">{selectedLeague.country} · 2025 Season</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-4" style={{ borderColor: 'var(--border)' }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setActiveTab(i)} className={clsx('tab', activeTab === i && 'active')}>
                {t}
              </button>
            ))}
          </div>

          {/* Standings */}
          {activeTab === 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs font-bold text-muted uppercase tracking-wider" style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left px-4 py-3 w-8">#</th>
                      <th className="text-left px-4 py-3">Team</th>
                      <th className="text-center px-3 py-3">P</th>
                      <th className="text-center px-3 py-3">W</th>
                      <th className="text-center px-3 py-3">D</th>
                      <th className="text-center px-3 py-3">L</th>
                      <th className="text-center px-3 py-3">GD</th>
                      <th className="text-center px-3 py-3 font-bold text-green-600 dark:text-green-400">Pts</th>
                      <th className="text-center px-3 py-3 hidden md:table-cell">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STANDINGS.map((row, idx) => (
                      <tr
                        key={row.rank}
                        className={clsx(
                          'border-b transition-colors hover:bg-green-50/50 dark:hover:bg-green-950/20 cursor-pointer',
                          idx < 4 && 'border-l-2 border-l-green-500'
                        )}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-4 py-3 text-muted font-semibold">{row.rank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img src={row.team.logo} alt={row.team.name} className="w-6 h-6 object-contain" />
                            <span className="font-semibold" style={{ color: 'var(--text)' }}>{row.team.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-3 text-muted">{row.played}</td>
                        <td className="text-center px-3 py-3 text-muted">{row.win}</td>
                        <td className="text-center px-3 py-3 text-muted">{row.draw}</td>
                        <td className="text-center px-3 py-3 text-muted">{row.lose}</td>
                        <td className={clsx('text-center px-3 py-3 font-medium', row.goals_diff > 0 ? 'text-green-600 dark:text-green-400' : row.goals_diff < 0 ? 'text-red-500' : 'text-muted')}>
                          {row.goals_diff > 0 ? '+' : ''}{row.goals_diff}
                        </td>
                        <td className="text-center px-3 py-3 font-bold" style={{ color: 'var(--text)' }}>{row.points}</td>
                        <td className="text-center px-3 py-3 hidden md:table-cell">
                          <FormCell form={row.form} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 flex items-center gap-4 text-xs text-muted border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Champions League</div>
              </div>
            </div>
          )}

          {/* Top Scorers */}
          {activeTab === 1 && (
            <div className="card overflow-hidden">
              {PLAYERS.filter(p => p.position === 'Attacker').map((player, i) => (
                <div key={player.id} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-lg font-black w-7 text-center" style={{ color: i < 3 ? '#16a34a' : 'var(--text-muted)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <img src={player.photo} alt={player.name} className="w-10 h-10 rounded-full object-cover" onError={e => e.target.src='https://api.dicebear.com/9.x/initials/svg?seed=' + player.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{player.name}</p>
                    <p className="text-xs text-muted">{player.team.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-green-600 dark:text-green-400">{20 - i * 2}</p>
                    <p className="text-xs text-muted">goals</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Assists */}
          {activeTab === 2 && (
            <div className="card overflow-hidden">
              {PLAYERS.slice(0, 6).map((player, i) => (
                <div key={player.id} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-lg font-black w-7 text-center" style={{ color: i < 3 ? '#16a34a' : 'var(--text-muted)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <img src={player.photo} alt={player.name} className="w-10 h-10 rounded-full object-cover" onError={e => e.target.src='https://api.dicebear.com/9.x/initials/svg?seed=' + player.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{player.name}</p>
                    <p className="text-xs text-muted">{player.team.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-green-600 dark:text-green-400">{14 - i * 2}</p>
                    <p className="text-xs text-muted">assists</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

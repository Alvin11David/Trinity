import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, Flame } from 'lucide-react'
import MatchCard from '../components/MatchCard'
import { MATCHES } from '../utils/mock'
import clsx from 'clsx'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'finished', label: 'Results' },
]

const LEAGUES = ['All Leagues', 'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1']

export default function Matches() {
  const [tab, setTab] = useState('all')
  const [league, setLeague] = useState('All Leagues')
  const [search, setSearch] = useState('')

  const filtered = MATCHES.filter(m => {
    if (tab !== 'all' && m.status !== tab) return false
    if (league !== 'All Leagues' && m.league_name !== league) return false
    if (search) {
      const q = search.toLowerCase()
      return m.home_team.name.toLowerCase().includes(q) || m.away_team.name.toLowerCase().includes(q) || m.league_name.toLowerCase().includes(q)
    }
    return true
  })

  const liveCount = MATCHES.filter(m => m.status === 'live').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>Matches</h1>
        <p className="text-sm text-muted">Live scores, fixtures, and results.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pl-10"
          placeholder="Search teams or competitions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* League filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {LEAGUES.map(l => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={clsx(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              league === l
                ? 'bg-green-600 text-white border-green-600'
                : 'border-current text-muted hover:border-green-500 hover:text-green-600'
            )}
            style={{ borderColor: league === l ? undefined : 'var(--border)' }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx('tab', tab === t.key && 'active', 'flex items-center gap-2')}
          >
            {t.key === 'live' && liveCount > 0 && (
              <span className="live-dot" />
            )}
            {t.label}
            {t.key === 'live' && liveCount > 0 && (
              <span className="badge-red badge text-[10px]">{liveCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Matches */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">No matches found</p>
          <p className="text-sm mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}

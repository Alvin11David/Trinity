import { useState } from 'react'
import { Search, Filter, X, TrendingUp } from 'lucide-react'
import { PLAYERS, formatValue } from '../utils/mock'
import clsx from 'clsx'

const POSITIONS = ['All', 'Goalkeeper', 'Defender', 'Midfielder', 'Attacker']
const POS_COLORS = {
  Goalkeeper: 'badge-yellow',
  Defender:   'badge-blue',
  Midfielder: 'badge-green',
  Attacker:   'badge-red',
}

function PlayerCard({ player }) {
  return (
    <div className="card p-4 hover:border-green-500/50 hover:shadow-md transition-all duration-150 cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <img
            src={player.photo}
            alt={player.name}
            className="w-14 h-14 rounded-xl object-cover group-hover:scale-105 transition-transform"
            onError={e => { e.target.src = `https://api.dicebear.com/9.x/initials/svg?seed=${player.name}` }}
          />
          {player.injured && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white font-bold">!</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>{player.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <img src={player.team.logo} alt={player.team.name} className="w-4 h-4 object-contain" />
                <span className="text-xs text-muted truncate">{player.team.name}</span>
              </div>
            </div>
            {player.number && (
              <span className="shrink-0 w-7 h-7 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 text-xs font-black flex items-center justify-center">
                {player.number}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {player.position && (
              <span className={clsx('badge', POS_COLORS[player.position] || 'badge-gray')}>
                {player.position}
              </span>
            )}
            <span className="badge badge-gray">{player.nationality}</span>
            {player.injured && <span className="badge badge-red">Injured</span>}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Age</span>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{player.age ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Height</span>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{player.height ?? '—'}</span>
            </div>
            {player.market_value_eur && (
              <div className="flex justify-between col-span-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="text-muted flex items-center gap-1"><TrendingUp size={11} /> Market Value</span>
                <span className="font-bold text-green-600 dark:text-green-400">{formatValue(player.market_value_eur)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Players() {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState('All')

  const filtered = PLAYERS.filter(p => {
    const matchPos = position === 'All' || p.position === position
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.team.name.toLowerCase().includes(search.toLowerCase())
    return matchPos && matchSearch
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>Players</h1>
        <p className="text-sm text-muted">Browse players, stats, and market values.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-10"
            placeholder="Search players or teams…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-red-500">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Position tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => setPosition(pos)}
            className={clsx(
              'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all',
              position === pos
                ? 'bg-green-600 text-white border-green-600'
                : 'text-muted hover:border-green-500 hover:text-green-600'
            )}
            style={{ borderColor: position === pos ? undefined : 'var(--border)' }}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Results */}
      <p className="text-xs text-muted mb-3 font-medium">{filtered.length} player{filtered.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => <PlayerCard key={p.id} player={p} />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="font-semibold">No players found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  )
}

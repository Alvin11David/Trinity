import { useState } from 'react'
import { Search, MapPin, Users, TrendingUp, X } from 'lucide-react'
import { TEAMS, formatValue } from '../utils/mock'
import clsx from 'clsx'

const COUNTRIES = ['All', 'England', 'Spain', 'Germany', 'Italy', 'France']

function TeamCard({ team, followed, onFollow }) {
  return (
    <div className="card p-5 hover:border-green-500/50 hover:shadow-md transition-all duration-150 cursor-pointer group">
      <div className="flex items-start gap-4">
        <img
          src={team.logo}
          alt={team.name}
          className="w-14 h-14 object-contain group-hover:scale-110 transition-transform duration-150"
          onError={e => e.target.style.display = 'none'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>{team.name}</h3>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted">
                <MapPin size={11} />
                <span>{team.country}</span>
                {team.venue_city && <span>· {team.venue_city}</span>}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onFollow(team.api_football_id) }}
              className={clsx(
                'shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-all',
                followed
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-current text-muted hover:border-green-500 hover:text-green-600'
              )}
              style={{ borderColor: followed ? undefined : 'var(--border)' }}
            >
              {followed ? 'Following' : 'Follow'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
            {team.venue_name && (
              <div className="flex justify-between col-span-2">
                <span className="text-muted">Stadium</span>
                <span className="font-medium truncate ml-2" style={{ color: 'var(--text)' }}>{team.venue_name}</span>
              </div>
            )}
            {team.venue_capacity && (
              <div className="flex justify-between">
                <span className="text-muted flex items-center gap-1"><Users size={11} /> Capacity</span>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{team.venue_capacity.toLocaleString()}</span>
              </div>
            )}
            {team.squad_value_eur && (
              <div className="flex justify-between">
                <span className="text-muted flex items-center gap-1"><TrendingUp size={11} /> Squad Value</span>
                <span className="font-bold text-green-600 dark:text-green-400">{formatValue(team.squad_value_eur)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Teams() {
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('All')
  const [followed, setFollowed] = useState(new Set([42]))

  const filtered = TEAMS.filter(t => {
    const matchCountry = country === 'All' || t.country === country
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.venue_city || '').toLowerCase().includes(search.toLowerCase())
    return matchCountry && matchSearch
  })

  const toggleFollow = (id) => {
    setFollowed(f => {
      const n = new Set(f)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>Teams</h1>
        <p className="text-sm text-muted">Follow your favourite clubs from around the world.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pl-10"
          placeholder="Search teams or cities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-red-500">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Country pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {COUNTRIES.map(c => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={clsx(
              'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all',
              country === c
                ? 'bg-green-600 text-white border-green-600'
                : 'text-muted hover:border-green-500 hover:text-green-600'
            )}
            style={{ borderColor: country === c ? undefined : 'var(--border)' }}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted mb-3 font-medium">{filtered.length} team{filtered.length !== 1 ? 's' : ''}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(team => (
          <TeamCard
            key={team.api_football_id}
            team={team}
            followed={followed.has(team.api_football_id)}
            onFollow={toggleFollow}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted">
          <span className="text-4xl mb-3 block">🏟️</span>
          <p className="font-semibold">No teams found</p>
          <p className="text-sm mt-1">Try a different search or country.</p>
        </div>
      )}
    </div>
  )
}

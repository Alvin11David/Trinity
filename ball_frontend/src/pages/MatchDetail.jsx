import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, User, Zap } from 'lucide-react'
import { MATCHES } from '../utils/mock'
import clsx from 'clsx'
import { useState } from 'react'

const EVENT_ICONS = {
  goal:         { icon: '⚽', color: 'text-green-500' },
  yellow_card:  { icon: '🟨', color: 'text-yellow-500' },
  red_card:     { icon: '🟥', color: 'text-red-500' },
  substitution: { icon: '🔄', color: 'text-blue-500' },
  var:          { icon: '📺', color: 'text-purple-500' },
  other:        { icon: '•',  color: 'text-muted' },
}

function StatBar({ label, home, away, max }) {
  const total = home + away || 1
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold" style={{ color: 'var(--text)' }}>
        <span>{home}</span>
        <span className="text-muted font-normal">{label}</span>
        <span>{away}</span>
      </div>
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${(home / total) * 100}%` }} />
        <div className="bg-gray-300 dark:bg-gray-600 rounded-r-full transition-all" style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  )
}

export default function MatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const match = MATCHES.find(m => String(m.id) === id) || MATCHES[0]
  const [activeTab, setActiveTab] = useState('events')
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  const tabs = ['events', 'stats', 'lineups', 'h2h']

  const mockStats = [
    { label: 'Possession', home: 54, away: 46 },
    { label: 'Shots', home: 12, away: 8 },
    { label: 'Shots on Target', home: 6, away: 3 },
    { label: 'Corners', home: 7, away: 4 },
    { label: 'Fouls', home: 9, away: 13 },
    { label: 'Offsides', home: 2, away: 4 },
    { label: 'Yellow Cards', home: 1, away: 2 },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium text-muted hover:text-green-600 mb-5 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Matches
      </button>

      {/* Score card */}
      <div className="card p-6 mb-6">
        {/* League + status */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted">{match.league_name}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">2025</span>
          </div>
          {isLive ? (
            <div className="flex items-center gap-1.5 bg-red-500/10 rounded-full px-3 py-1">
              <span className="live-dot" />
              <span className="text-xs font-bold text-red-500">{match.minute}' LIVE</span>
            </div>
          ) : isFinished ? (
            <span className="badge badge-gray">Full Time</span>
          ) : (
            <span className="badge badge-green">Upcoming</span>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex-1 flex flex-col items-center gap-3">
            <img src={match.home_team.logo} alt={match.home_team.name} className="w-16 h-16 object-contain" />
            <span className="font-bold text-sm text-center" style={{ color: 'var(--text)' }}>{match.home_team.name}</span>
          </div>
          <div className="text-center">
            {match.home_score != null ? (
              <div className={clsx('text-5xl font-black', isLive && 'text-red-500')} style={{ color: isLive ? undefined : 'var(--text)' }}>
                {match.home_score} – {match.away_score}
              </div>
            ) : (
              <div className="text-3xl font-black text-muted">vs</div>
            )}
            <div className="text-xs text-muted mt-1">
              HT: {match.halftime_home_score ?? '–'} – {match.halftime_away_score ?? '–'}
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-3">
            <img src={match.away_team.logo} alt={match.away_team.name} className="w-16 h-16 object-contain" />
            <span className="font-bold text-sm text-center" style={{ color: 'var(--text)' }}>{match.away_team.name}</span>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} />
            <span>{match.venue_name}, {match.venue_city}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} />
            <span>{new Date(match.kickoff_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Prediction */}
        {match.winnie_prediction && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={13} className="text-green-500" />
              <span className="text-xs font-bold text-green-500">Winnie Prediction</span>
            </div>
            <div className="flex text-xs font-semibold justify-between mb-1.5">
              <span className="text-green-600 dark:text-green-400">{match.home_team.name} {match.winnie_prediction.home_win}%</span>
              <span className="text-muted">Draw {match.winnie_prediction.draw}%</span>
              <span>{match.away_team.name} {match.winnie_prediction.away_win}%</span>
            </div>
            <div className="flex rounded-full overflow-hidden h-2">
              <div className="bg-green-500" style={{ width: `${match.winnie_prediction.home_win}%` }} />
              <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${match.winnie_prediction.draw}%` }} />
              <div className="bg-red-400" style={{ width: `${match.winnie_prediction.away_win}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={clsx('tab capitalize', activeTab === t && 'active')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Events */}
      {activeTab === 'events' && (
        <div>
          {match.events.length === 0 ? (
            <p className="text-center text-muted py-8 text-sm">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {match.events.map(ev => {
                const cfg = EVENT_ICONS[ev.event_type] || EVENT_ICONS.other
                const isHome = ev.team?.api_football_id === match.home_team.api_football_id
                return (
                  <div key={ev.id} className={clsx('flex items-center gap-3 py-2 px-3 rounded-xl', isHome ? 'flex-row' : 'flex-row-reverse')} style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <span className="text-xl shrink-0">{cfg.icon}</span>
                    <div className={clsx('flex-1', !isHome && 'text-right')}>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{ev.player}</span>
                      {ev.assist_player && (
                        <span className="text-xs text-muted ml-1">({ev.assist_player})</span>
                      )}
                    </div>
                    <div className="shrink-0 text-center">
                      <span className="text-xs font-bold text-muted">{ev.minute}'</span>
                    </div>
                    <div className={clsx('flex-1', isHome && 'text-right')}>
                      <span className="text-xs text-muted">{ev.detail}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {activeTab === 'stats' && (
        <div className="card p-5 space-y-4">
          <div className="flex justify-between text-xs font-bold mb-2 text-muted">
            <span>{match.home_team.name}</span>
            <span>{match.away_team.name}</span>
          </div>
          {mockStats.map(s => (
            <StatBar key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Lineups */}
      {activeTab === 'lineups' && (
        <div className="card p-5">
          <p className="text-sm text-muted text-center py-6">
            Lineup data will be available closer to kickoff.
          </p>
        </div>
      )}

      {/* H2H */}
      {activeTab === 'h2h' && (
        <div className="space-y-3">
          {MATCHES.slice(0, 3).map(m => (
            <div key={m.id} className="card p-3 flex items-center justify-between text-sm">
              <span className="font-medium" style={{ color: 'var(--text)' }}>{m.home_team.name}</span>
              <span className="font-black" style={{ color: 'var(--text)' }}>
                {m.home_score ?? '–'} – {m.away_score ?? '–'}
              </span>
              <span className="font-medium text-right" style={{ color: 'var(--text)' }}>{m.away_team.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

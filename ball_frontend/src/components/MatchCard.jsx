import { useNavigate } from 'react-router-dom'
import { formatKickoff } from '../utils/mock'
import clsx from 'clsx'

function FormBadge({ result }) {
  const colors = {
    W: 'bg-green-500',
    D: 'bg-gray-400',
    L: 'bg-red-500',
  }
  return (
    <span className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold', colors[result])}>
      {result}
    </span>
  )
}

export default function MatchCard({ match }) {
  const navigate = useNavigate()
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const upcoming = formatKickoff(match.kickoff_time)

  return (
    <div
      onClick={() => navigate(`/matches/${match.id}`)}
      className={clsx(
        'card p-4 cursor-pointer hover:border-green-500/50 transition-all duration-150 hover:shadow-md',
        isLive && 'border-red-500/40 dark:border-red-500/30'
      )}
    >
      {/* League + status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted">{match.league_name}</span>
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="live-dot" />
            <span className="text-xs font-bold text-red-500">{match.minute}'</span>
          </div>
        ) : isFinished ? (
          <span className="badge badge-gray">FT</span>
        ) : upcoming ? (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">in {upcoming}</span>
        ) : (
          <span className="text-xs text-muted">
            {new Date(match.kickoff_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 flex items-center gap-2.5">
          <img
            src={match.home_team.logo}
            alt={match.home_team.name}
            className="w-8 h-8 object-contain"
            onError={e => { e.target.onerror = null; e.target.src = '' }}
          />
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
            {match.home_team.name}
          </span>
        </div>

        {/* Score */}
        <div className="text-center shrink-0 min-w-[56px]">
          {match.home_score != null ? (
            <span className={clsx('font-black text-xl', isLive ? 'text-red-500' : '')} style={{ color: isLive ? undefined : 'var(--text)' }}>
              {match.home_score} – {match.away_score}
            </span>
          ) : (
            <span className="font-bold text-sm text-muted">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex items-center gap-2.5 justify-end">
          <span className="font-semibold text-sm truncate text-right" style={{ color: 'var(--text)' }}>
            {match.away_team.name}
          </span>
          <img
            src={match.away_team.logo}
            alt={match.away_team.name}
            className="w-8 h-8 object-contain"
            onError={e => { e.target.onerror = null; e.target.src = '' }}
          />
        </div>
      </div>

      {/* Winnie prediction bar */}
      {match.winnie_prediction && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex text-[11px] font-semibold text-muted justify-between mb-1.5">
            <span className="text-green-600 dark:text-green-400">{match.winnie_prediction.home_win}%</span>
            <span>Draw {match.winnie_prediction.draw}%</span>
            <span>{match.winnie_prediction.away_win}%</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-1.5">
            <div className="bg-green-500" style={{ width: `${match.winnie_prediction.home_win}%` }} />
            <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${match.winnie_prediction.draw}%` }} />
            <div className="bg-red-400" style={{ width: `${match.winnie_prediction.away_win}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

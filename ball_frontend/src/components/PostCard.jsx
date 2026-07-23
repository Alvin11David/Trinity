import { useState } from 'react'
import { MessageCircle, Repeat2, Share2, Zap, Flame, Brain, ThumbsDown } from 'lucide-react'
import { formatTime } from '../utils/mock'
import clsx from 'clsx'

const REACTION_CONFIG = {
  goal:     { icon: '⚽', label: 'Goal', color: 'text-green-500' },
  hot_take: { icon: '🔥', label: 'Hot Take', color: 'text-orange-500' },
  smart:    { icon: '🧠', label: 'Smart', color: 'text-blue-500' },
  terrible: { icon: '💀', label: 'Terrible', color: 'text-red-500' },
}

function ScoreBadge({ match }) {
  const isLive = match.status === 'live'
  return (
    <div
      className="rounded-xl border p-3 my-2 flex items-center justify-between gap-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <img src={match.home_team.logo} alt={match.home_team.name} className="w-7 h-7 object-contain" onError={e => e.target.style.display='none'} />
        <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{match.home_team.name}</span>
      </div>
      <div className="text-center shrink-0">
        {match.home_score != null ? (
          <span className="font-black text-lg" style={{ color: 'var(--text)' }}>
            {match.home_score} – {match.away_score}
          </span>
        ) : (
          <span className="font-semibold text-sm text-muted">vs</span>
        )}
        {isLive && (
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="live-dot" />
            <span className="text-xs font-bold text-red-500">{match.minute}'</span>
          </div>
        )}
        {match.status === 'finished' && (
          <div className="text-xs text-muted mt-0.5">FT</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="font-semibold text-sm truncate text-right" style={{ color: 'var(--text)' }}>{match.away_team.name}</span>
        <img src={match.away_team.logo} alt={match.away_team.name} className="w-7 h-7 object-contain" onError={e => e.target.style.display='none'} />
      </div>
    </div>
  )
}

export default function PostCard({ post, onReact }) {
  const [localReaction, setLocalReaction] = useState(post.user_reaction)
  const [reactions, setReactions] = useState(post.reactions)

  const handleReact = (type) => {
    setLocalReaction(prev => {
      const next = prev === type ? null : type
      setReactions(r => {
        const updated = { ...r }
        if (prev) updated[prev] = Math.max(0, updated[prev] - 1)
        if (next) updated[next] = (updated[next] || 0) + 1
        return updated
      })
      return next
    })
  }

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0)

  return (
    <article
      className="border-b px-4 py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer animate-fade-in"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Winnie insight label */}
      {post.post_type === 'winnie_insight' && (
        <div className="flex items-center gap-1.5 mb-2">
          <Zap size={13} className="text-green-500" />
          <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Winnie Insight</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <img
          src={post.author.avatar}
          alt={post.author.username}
          className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-transparent hover:ring-green-500 transition-all"
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              {post.author.first_name} {post.author.last_name}
            </span>
            <span className="text-sm text-muted">@{post.author.username}</span>
            <span className="text-muted text-xs">·</span>
            <span className="text-xs text-muted">{formatTime(post.created_at)}</span>
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text)' }}>
            {post.content}
          </p>

          {/* Match embed */}
          {post.match && <ScoreBadge match={post.match} />}

          {/* Reactions bar */}
          {totalReactions > 0 && (
            <div className="flex items-center gap-3 mb-2 text-xs text-muted">
              {Object.entries(reactions).map(([type, count]) =>
                count > 0 ? (
                  <span key={type}>
                    {REACTION_CONFIG[type].icon} {count}
                  </span>
                ) : null
              )}
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-1 -ml-2">
            {Object.entries(REACTION_CONFIG).map(([type, cfg]) => (
              <button
                key={type}
                onClick={(e) => { e.stopPropagation(); handleReact(type) }}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105',
                  localReaction === type
                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-muted'
                )}
              >
                <span>{cfg.icon}</span>
                <span className="hidden sm:inline">{cfg.label}</span>
              </button>
            ))}

            <div className="ml-auto flex items-center gap-1">
              <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-green-500 transition-colors">
                <MessageCircle size={15} />
                <span>{post.comments_count}</span>
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-green-500 transition-colors">
                <Repeat2 size={15} />
                <span>{post.reposts_count}</span>
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-green-500 transition-colors">
                <Share2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

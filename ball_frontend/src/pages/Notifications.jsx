import { useState } from 'react'
import { Bell, Check, Trophy, UserPlus, MessageCircle, Repeat2, Zap, Users, Star } from 'lucide-react'
import { NOTIFICATIONS, formatTime } from '../utils/mock'
import clsx from 'clsx'

const TYPE_CONFIG = {
  goal:          { icon: '⚽', color: 'bg-green-100 dark:bg-green-950', iconColor: 'text-green-500' },
  kickoff:       { icon: '🏁', color: 'bg-blue-100 dark:bg-blue-950',  iconColor: 'text-blue-500' },
  follow:        { icon: '👤', color: 'bg-purple-100 dark:bg-purple-950', iconColor: 'text-purple-500' },
  reaction:      { icon: '⚡', color: 'bg-yellow-100 dark:bg-yellow-950', iconColor: 'text-yellow-500' },
  reply:         { icon: '💬', color: 'bg-green-100 dark:bg-green-950', iconColor: 'text-green-500' },
  repost:        { icon: '🔄', color: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-500' },
  winnie_alert:  { icon: '🧠', color: 'bg-indigo-100 dark:bg-indigo-950', iconColor: 'text-indigo-500' },
  community_post:{ icon: '🏘️', color: 'bg-orange-100 dark:bg-orange-950', iconColor: 'text-orange-500' },
  match_result:  { icon: '🏆', color: 'bg-green-100 dark:bg-green-950', iconColor: 'text-green-500' },
  mention:       { icon: '@', color: 'bg-pink-100 dark:bg-pink-950', iconColor: 'text-pink-500' },
  card:          { icon: '🟨', color: 'bg-yellow-100 dark:bg-yellow-950', iconColor: 'text-yellow-500' },
  substitution:  { icon: '🔄', color: 'bg-blue-100 dark:bg-blue-950', iconColor: 'text-blue-500' },
}

function NotifItem({ notif, onRead }) {
  const cfg = TYPE_CONFIG[notif.notification_type] || TYPE_CONFIG.goal

  return (
    <div
      onClick={() => onRead(notif.id)}
      className={clsx(
        'flex items-start gap-4 px-4 py-4 cursor-pointer transition-colors border-b last:border-0',
        notif.is_read
          ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
          : 'bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30'
      )}
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Icon */}
      <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg', cfg.color)}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {notif.sender && (
              <div className="flex items-center gap-2 mb-0.5">
                <img src={notif.sender.avatar} alt={notif.sender.username} className="w-5 h-5 rounded-full object-cover" />
                <span className="text-xs font-semibold text-muted">@{notif.sender.username}</span>
              </div>
            )}
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{notif.title}</p>
            <p className="text-sm text-muted mt-0.5 leading-relaxed">{notif.body}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {!notif.is_read && (
              <div className="w-2 h-2 rounded-full bg-green-500" />
            )}
            <span className="text-xs text-muted whitespace-nowrap">{formatTime(notif.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const TABS = ['All', 'Mentions', 'Social', 'Match Alerts']

export default function Notifications() {
  const [notifs, setNotifs] = useState(NOTIFICATIONS)
  const [activeTab, setActiveTab] = useState('All')
  const unread = notifs.filter(n => !n.is_read).length

  const markRead = (id) => {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = () => {
    setNotifs(ns => ns.map(n => ({ ...n, is_read: true })))
  }

  const filterFn = (n) => {
    if (activeTab === 'Mentions') return n.notification_type === 'mention' || n.notification_type === 'reply'
    if (activeTab === 'Social') return ['follow', 'reaction', 'repost', 'community_post'].includes(n.notification_type)
    if (activeTab === 'Match Alerts') return ['goal', 'kickoff', 'card', 'substitution', 'match_result', 'winnie_alert'].includes(n.notification_type)
    return true
  }

  const filtered = notifs.filter(filterFn)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>Notifications</h1>
          {unread > 0 && (
            <p className="text-sm text-muted mt-0.5">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:underline"
          >
            <Check size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-0 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={clsx('tab whitespace-nowrap', activeTab === t && 'active')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="card overflow-hidden mt-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Bell size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No notifications here</p>
          </div>
        ) : (
          filtered.map(n => <NotifItem key={n.id} notif={n} onRead={markRead} />)
        )}
      </div>
    </div>
  )
}

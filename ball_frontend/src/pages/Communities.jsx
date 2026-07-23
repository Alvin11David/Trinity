import { useState } from 'react'
import { Search, Users, Shield, Plus, X } from 'lucide-react'
import { COMMUNITIES, POSTS, CURRENT_USER } from '../utils/mock'
import PostCard from '../components/PostCard'
import clsx from 'clsx'

function CommunityCard({ community, joined, onJoin }) {
  return (
    <div
      className="card p-4 hover:border-green-500/50 hover:shadow-md transition-all duration-150 cursor-pointer group"
    >
      <div className="flex gap-3">
        {community.avatar ? (
          <img
            src={community.avatar}
            alt={community.name}
            className="w-12 h-12 rounded-xl object-contain bg-gray-100 dark:bg-gray-800 p-1"
            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
          />
        ) : null}
        <div
          className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950 flex items-center justify-center"
          style={{ display: community.avatar ? 'none' : 'flex' }}
        >
          <span className="text-green-700 dark:text-green-400 font-black text-lg">
            {community.name.charAt(0)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{community.name}</h3>
                {community.is_official && (
                  <Shield size={13} className="text-green-500 shrink-0" fill="currentColor" />
                )}
              </div>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{community.description}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onJoin(community.id) }}
              className={clsx(
                'shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-all whitespace-nowrap',
                joined
                  ? 'bg-green-600 text-white border-green-600'
                  : 'text-muted hover:border-green-500 hover:text-green-600'
              )}
              style={{ borderColor: joined ? undefined : 'var(--border)' }}
            >
              {joined ? 'Joined' : 'Join'}
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted">
            <div className="flex items-center gap-1">
              <Users size={11} />
              <span>{(community.members_count / 1000).toFixed(1)}K members</span>
            </div>
            <span>·</span>
            <span>{(community.posts_count / 1000).toFixed(1)}K posts</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Communities() {
  const [search, setSearch] = useState('')
  const [joined, setJoined] = useState(new Set([1, 6]))
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('discover')

  const filtered = COMMUNITIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())
  )

  const toggleJoin = (id) => {
    setJoined(j => {
      const n = new Set(j)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm font-medium text-muted hover:text-green-600 mb-5 transition-colors"
        >
          ← Back to Communities
        </button>

        {/* Community banner */}
        <div className="card overflow-hidden mb-4">
          <div className="h-28 bg-gradient-to-br from-green-600 to-green-800 relative">
            {selected.avatar && (
              <img src={selected.avatar} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            )}
          </div>
          <div className="px-5 pb-5 -mt-6 relative">
            <div className="flex items-end justify-between gap-3">
              <div className="w-14 h-14 rounded-xl border-4 bg-white dark:bg-dark-card overflow-hidden flex items-center justify-center" style={{ borderColor: 'var(--card)' }}>
                {selected.avatar ? (
                  <img src={selected.avatar} alt={selected.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-green-700 dark:text-green-400 font-black text-2xl">{selected.name.charAt(0)}</span>
                )}
              </div>
              <button
                onClick={() => toggleJoin(selected.id)}
                className={clsx('btn-primary py-1.5 px-4 text-sm', joined.has(selected.id) && 'bg-gray-500 hover:bg-gray-600')}
              >
                {joined.has(selected.id) ? 'Leave' : 'Join'}
              </button>
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{selected.name}</h2>
                {selected.is_official && <Shield size={15} className="text-green-500" fill="currentColor" />}
              </div>
              <p className="text-sm text-muted mt-1">{selected.description}</p>
              <div className="flex gap-4 mt-2 text-xs text-muted">
                <span><strong style={{ color: 'var(--text)' }}>{(selected.members_count / 1000).toFixed(1)}K</strong> members</span>
                <span><strong style={{ color: 'var(--text)' }}>{(selected.posts_count / 1000).toFixed(1)}K</strong> posts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="card overflow-hidden">
          {POSTS.slice(0, 3).map(post => <PostCard key={post.id} post={post} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>Communities</h1>
          <p className="text-sm text-muted">Join communities built around the game.</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: 'var(--border)' }}>
        {['discover', 'joined'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={clsx('tab capitalize', activeTab === t && 'active')}>
            {t === 'joined' ? `Joined (${joined.size})` : 'Discover'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-10" placeholder="Search communities…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-red-500"><X size={15} /></button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered
          .filter(c => activeTab === 'discover' || joined.has(c.id))
          .map(c => (
            <div key={c.id} onClick={() => setSelected(c)}>
              <CommunityCard community={c} joined={joined.has(c.id)} onJoin={toggleJoin} />
            </div>
          ))}
      </div>

      {filtered.filter(c => activeTab === 'discover' || joined.has(c.id)).length === 0 && (
        <div className="text-center py-16 text-muted">
          <span className="text-4xl mb-3 block">🏟️</span>
          <p className="font-semibold">{activeTab === 'joined' ? "You haven't joined any communities yet." : "No communities found."}</p>
        </div>
      )}
    </div>
  )
}

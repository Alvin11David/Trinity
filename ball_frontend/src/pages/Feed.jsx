import { useState } from 'react'
import { Image, Send, X, Zap } from 'lucide-react'
import PostCard from '../components/PostCard'
import MatchCard from '../components/MatchCard'
import { POSTS, MATCHES, CURRENT_USER, STANDINGS, TEAMS } from '../utils/mock'
import clsx from 'clsx'

const TABS = ['For You', 'Following', 'Global']

function ComposeBox({ onPost }) {
  const [content, setContent] = useState('')
  const maxLen = 500

  return (
    <div
      className="border-b px-4 py-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex gap-3">
        <img
          src={CURRENT_USER.avatar}
          alt={CURRENT_USER.username}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <textarea
            className="w-full text-sm leading-relaxed resize-none outline-none placeholder:text-muted bg-transparent"
            style={{ color: 'var(--text)' }}
            placeholder="What's on your mind about football?"
            rows={3}
            value={content}
            onChange={e => setContent(e.target.value.slice(0, maxLen))}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors">
                <Image size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className={clsx('text-xs font-medium', content.length > 450 ? 'text-orange-500' : 'text-muted')}>
                {content.length}/{maxLen}
              </span>
              <button
                onClick={() => { if (content.trim()) { onPost(content); setContent('') } }}
                disabled={!content.trim()}
                className="btn-primary py-1.5 px-4 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Send size={15} />
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveBanner({ match }) {
  return (
    <div className="mx-4 my-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="live-dot" />
        <span className="text-xs font-bold text-red-500 uppercase">Live</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {match.home_team.name} <span className="text-red-500 font-black">{match.home_score}–{match.away_score}</span> {match.away_team.name}
        </span>
      </div>
      <span className="text-xs font-bold text-red-500">{match.minute}'</span>
    </div>
  )
}

function TrendingTopics() {
  const topics = [
    { tag: '#ElClasico', posts: '42.3K posts' },
    { tag: '#Saka', posts: '18.1K posts' },
    { tag: '#PremierLeague', posts: '91.4K posts' },
    { tag: '#Haaland', posts: '11.2K posts' },
  ]
  return (
    <div className="card p-4">
      <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Trending</h3>
      <div className="space-y-3">
        {topics.map(t => (
          <div key={t.tag} className="cursor-pointer hover:opacity-80 transition-opacity">
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{t.tag}</p>
            <p className="text-xs text-muted">{t.posts}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SuggestedTeams() {
  return (
    <div className="card p-4">
      <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Follow Teams</h3>
      <div className="space-y-2">
        {TEAMS.slice(0, 4).map(t => (
          <div key={t.api_football_id} className="flex items-center gap-2.5">
            <img src={t.logo} alt={t.name} className="w-7 h-7 object-contain" onError={e => e.target.style.display = 'none'} />
            <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text)' }}>{t.name}</span>
            <button className="text-xs font-semibold text-green-600 dark:text-green-400 border border-green-500/40 rounded-full px-2.5 py-0.5 hover:bg-green-50 dark:hover:bg-green-950 transition-colors">
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Feed() {
  const [activeTab, setActiveTab] = useState(0)
  const [posts, setPosts] = useState(POSTS)
  const liveMatch = MATCHES.find(m => m.status === 'live')

  const handlePost = (content) => {
    const newPost = {
      id: Date.now(),
      post_type: 'text',
      author: CURRENT_USER,
      content,
      reactions: { goal: 0, hot_take: 0, smart: 0, terrible: 0 },
      comments_count: 0,
      reposts_count: 0,
      user_reaction: null,
      created_at: new Date().toISOString(),
      media: [],
    }
    setPosts(p => [newPost, ...p])
  }

  return (
    <div className="max-w-6xl mx-auto flex gap-6 px-4 py-6">
      {/* Main feed */}
      <div className="flex-1 min-w-0">
        {/* Tabs */}
        <div
          className="flex border-b mb-0 sticky top-0 z-10"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
        >
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={clsx('tab flex-1 text-center', activeTab === i && 'active')}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Live banner */}
        {liveMatch && <LiveBanner match={liveMatch} />}

        {/* Compose */}
        <ComposeBox onPost={handlePost} />

        {/* Posts */}
        <div>
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="hidden xl:flex flex-col gap-4 w-72 shrink-0">
        {/* Today's matches */}
        <div>
          <h3 className="font-bold text-sm mb-3 px-1" style={{ color: 'var(--text)' }}>Today's Matches</h3>
          <div className="space-y-2">
            {MATCHES.slice(0, 3).map(m => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>

        <TrendingTopics />
        <SuggestedTeams />
      </aside>
    </div>
  )
}

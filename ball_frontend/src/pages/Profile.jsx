import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Settings, MapPin, Calendar, Link2, Edit3, UserPlus, UserCheck } from 'lucide-react'
import { CURRENT_USER, USERS, POSTS, formatTime } from '../utils/mock'
import PostCard from '../components/PostCard'
import clsx from 'clsx'

const TABS = ['Posts', 'Replies', 'Media', 'Reposts']

function StatPill({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-lg font-black" style={{ color: 'var(--text)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-muted font-medium">{label}</p>
    </div>
  )
}

function EditProfileModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ bio: user.bio, favorite_club: user.favorite_club || '' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md animate-fade-in" style={{ background: 'var(--card)' }}>
        <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>Edit Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="form-label">Bio</label>
            <textarea
              className="input resize-none"
              rows={3}
              maxLength={280}
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            />
            <p className="text-xs text-muted text-right mt-1">{form.bio.length}/280</p>
          </div>
          <div>
            <label className="form-label">Favourite Club</label>
            <input
              className="input"
              value={form.favorite_club}
              onChange={e => setForm(f => ({ ...f, favorite_club: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary flex-1">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { username } = useParams()
  const isOwn = !username || username === CURRENT_USER.username
  const viewUser = isOwn ? CURRENT_USER : (USERS.find(u => u.username === username) || USERS[0])

  const [activeTab, setActiveTab] = useState(0)
  const [following, setFollowing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [user, setUser] = useState({ ...CURRENT_USER })

  const displayUser = isOwn ? user : viewUser
  const userPosts = POSTS.filter(p => p.author.username === displayUser.username || POSTS.slice(0, 2))

  return (
    <div className="max-w-2xl mx-auto">
      {/* Banner */}
      <div
        className="h-36 sm:h-48 w-full relative"
        style={{
          background: displayUser.banner
            ? `url(${displayUser.banner}) center/cover`
            : 'linear-gradient(135deg, #14532d 0%, #166534 40%, #16a34a 100%)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
      </div>

      {/* Profile info */}
      <div className="px-4 sm:px-6 pb-0">
        <div className="flex items-end justify-between -mt-12 mb-3 relative z-10">
          <div className="relative">
            <img
              src={displayUser.avatar}
              alt={displayUser.username}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 shadow-lg"
              style={{ borderColor: 'var(--bg)' }}
            />
            {isOwn && (
              <button
                onClick={() => setEditOpen(true)}
                className="absolute bottom-1 right-1 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors"
              >
                <Edit3 size={13} className="text-white" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pb-2">
            {isOwn ? (
              <button onClick={() => setEditOpen(true)} className="btn-secondary py-1.5 px-4 text-sm flex items-center gap-1.5">
                <Edit3 size={14} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={() => setFollowing(f => !f)}
                  className={clsx('py-1.5 px-4 text-sm font-semibold rounded-lg border transition-all flex items-center gap-1.5', following ? 'btn-secondary' : 'btn-primary')}
                >
                  {following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Name + meta */}
        <div className="mb-3">
          <h1 className="text-xl font-black" style={{ color: 'var(--text)' }}>
            {displayUser.first_name} {displayUser.last_name}
          </h1>
          <p className="text-sm text-muted font-medium">@{displayUser.username}</p>

          {displayUser.bio && (
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text)' }}>{displayUser.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-muted">
            {displayUser.favorite_club && (
              <div className="flex items-center gap-1">
                <span>⚽</span>
                <span>{displayUser.favorite_club}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>Joined July 2025</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className="flex items-center gap-6 py-4 border-y mb-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <StatPill label="Posts" value={displayUser.posts_count || POSTS.length} />
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <StatPill label="Followers" value={displayUser.followers_count} />
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <StatPill label="Following" value={displayUser.following_count} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className={clsx('tab flex-1 text-center', activeTab === i && 'active')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div>
        {activeTab === 0 && (
          POSTS.map(post => <PostCard key={post.id} post={post} />)
        )}
        {activeTab === 1 && (
          <div className="text-center py-16 text-muted">
            <p className="text-3xl mb-3">💬</p>
            <p className="font-semibold">No replies yet</p>
          </div>
        )}
        {activeTab === 2 && (
          <div className="p-4 grid grid-cols-3 gap-1">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg" />
            ))}
          </div>
        )}
        {activeTab === 3 && (
          <div className="text-center py-16 text-muted">
            <p className="text-3xl mb-3">🔄</p>
            <p className="font-semibold">No reposts yet</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSave={(form) => { setUser(u => ({ ...u, ...form })); setEditOpen(false) }}
        />
      )}
    </div>
  )
}

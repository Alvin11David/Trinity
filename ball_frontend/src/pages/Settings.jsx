import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, AtSign, Bell, Palette, Shield, AlertTriangle,
  Camera, Eye, EyeOff, Check, X, ChevronRight,
  Monitor, Moon, Sun, Globe, Smartphone, Laptop,
  LogOut, Trash2, Lock, Key, RefreshCw, Copy, CheckCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { CURRENT_USER } from '../utils/mock'
import clsx from 'clsx'

// ─── Section IDs ────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'profile',       icon: User,          label: 'Edit Profile' },
  { id: 'account',       icon: AtSign,        label: 'Account' },
  { id: 'notifications', icon: Bell,          label: 'Notifications' },
  { id: 'appearance',    icon: Palette,       label: 'Appearance' },
  { id: 'security',      icon: Shield,        label: 'Security' },
  { id: 'danger',        icon: AlertTriangle, label: 'Danger Zone' },
]

// ─── Shared helpers ──────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-6 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={20} className="text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function FormRow({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <div className="sm:w-40 flex-shrink-0">
        <label className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</label>
        {hint && <p className="text-xs text-muted mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
        checked ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function SaveRow({ onSave, saved }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 mt-2">
      {saved && (
        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 animate-fade-in">
          <Check size={15} /> Saved
        </span>
      )}
      <button onClick={onSave} className="btn-primary">Save Changes</button>
    </div>
  )
}

// ─── Edit Profile ────────────────────────────────────────────────────────────
function EditProfileSection() {
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(CURRENT_USER.avatar)
  const [form, setForm] = useState({
    first_name: CURRENT_USER.first_name,
    last_name: CURRENT_USER.last_name,
    bio: CURRENT_USER.bio,
    favorite_club: CURRENT_USER.favorite_club || '',
  })
  const fileRef = useRef()

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAvatarUrl(url)
    }
  }

  return (
    <div>
      <SectionHeader icon={User} title="Edit Profile" description="Update your public profile information." />

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative">
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-20 h-20 rounded-full object-cover border-2"
            style={{ borderColor: 'var(--border)' }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors shadow"
            title="Change photo"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Profile photo</p>
          <p className="text-xs text-muted mt-0.5">JPG, PNG or GIF · Max 5 MB</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline mt-1 block"
          >
            Change photo
          </button>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        <FormRow label="First name">
          <input
            className="input"
            value={form.first_name}
            onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
          />
        </FormRow>
        <FormRow label="Last name">
          <input
            className="input"
            value={form.last_name}
            onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
          />
        </FormRow>
        <FormRow label="Bio" hint="Max 280 characters. Shown on your profile.">
          <textarea
            className="input resize-none"
            rows={3}
            maxLength={280}
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          />
          <p className="text-xs text-muted text-right mt-1">{form.bio.length}/280</p>
        </FormRow>
        <FormRow label="Favourite club" hint="Your primary football club.">
          <input
            className="input"
            placeholder="e.g. Arsenal"
            value={form.favorite_club}
            onChange={e => setForm(f => ({ ...f, favorite_club: e.target.value }))}
          />
        </FormRow>
      </div>

      <SaveRow onSave={handleSave} saved={saved} />
    </div>
  )
}

// ─── Account ─────────────────────────────────────────────────────────────────
function AccountSection() {
  const [saved, setSaved] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [form, setForm] = useState({
    username: CURRENT_USER.username,
    email: 'marcus.owusu@example.com',
  })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handlePwSave = () => {
    if (pw.next.length < 8) return setPwError('Password must be at least 8 characters.')
    if (pw.next !== pw.confirm) return setPwError('New passwords do not match.')
    setPwError('')
    setPw({ current: '', next: '', confirm: '' })
    setPwSaved(true)
    setTimeout(() => setPwSaved(false), 2500)
  }

  return (
    <div className="space-y-8">
      {/* Account info */}
      <div>
        <SectionHeader icon={AtSign} title="Account" description="Manage your username, email and password." />
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          <FormRow label="Username" hint="Your @handle visible to everyone.">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted select-none">@</span>
              <input
                className="input pl-7"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>
          </FormRow>
          <FormRow label="Email" hint="Used for sign-in and notifications.">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </FormRow>
        </div>
        <SaveRow onSave={handleSave} saved={saved} />
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }} />

      {/* Password change */}
      <div>
        <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>Change Password</h3>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          <FormRow label="Current password">
            <div className="relative">
              <input
                className="input pr-10"
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                value={pw.current}
                onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[var(--text)] transition-colors"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormRow>
          <FormRow label="New password" hint="Min. 8 characters.">
            <div className="relative">
              <input
                className="input pr-10"
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password"
                value={pw.next}
                onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[var(--text)] transition-colors"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pw.next && (
              <StrengthBar password={pw.next} />
            )}
          </FormRow>
          <FormRow label="Confirm new password">
            <div className="relative">
              <input
                className="input pr-10"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[var(--text)] transition-colors"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormRow>
        </div>
        {pwError && (
          <p className="text-sm text-red-500 mt-2 flex items-center gap-1.5">
            <X size={14} /> {pwError}
          </p>
        )}
        <div className="flex items-center justify-end gap-3 pt-4 mt-2">
          {pwSaved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 animate-fade-in">
              <Check size={15} /> Password updated
            </span>
          )}
          <button onClick={handlePwSave} className="btn-primary">Update Password</button>
        </div>
      </div>
    </div>
  )
}

function StrengthBar({ password }) {
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colours = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div
            key={i}
            className={clsx('h-1 flex-1 rounded-full transition-colors', i <= score ? colours[score] : 'bg-gray-200 dark:bg-gray-700')}
          />
        ))}
      </div>
      <p className="text-xs text-muted mt-1">{labels[score]}</p>
    </div>
  )
}

// ─── Notifications ───────────────────────────────────────────────────────────
const NOTIF_GROUPS = [
  {
    label: 'Social',
    items: [
      { id: 'likes',     label: 'Reactions to your posts',   hint: 'When someone reacts ⚽ 🔥 🧠 💀 to a post' },
      { id: 'comments',  label: 'Comments',                  hint: 'When someone replies to your posts' },
      { id: 'follows',   label: 'New followers',             hint: 'When someone follows you' },
      { id: 'mentions',  label: 'Mentions',                  hint: 'When someone @mentions you' },
      { id: 'reposts',   label: 'Reposts',                   hint: 'When someone reposts your content' },
    ],
  },
  {
    label: 'Football',
    items: [
      { id: 'goals',     label: 'Goal alerts',               hint: 'Live goal notifications for followed teams' },
      { id: 'kickoff',   label: 'Kick-off reminders',        hint: '15 min before matches start' },
      { id: 'results',   label: 'Final results',             hint: 'Full-time score for your teams' },
      { id: 'transfers', label: 'Transfer news',             hint: 'Moves involving teams you follow' },
    ],
  },
  {
    label: 'Channels',
    items: [
      { id: 'push',      label: 'Push notifications',        hint: 'Browser / device push' },
      { id: 'email_notif', label: 'Email digest',            hint: 'Weekly summary of activity' },
    ],
  },
]

function NotificationsSection() {
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState({
    likes: true, comments: true, follows: true, mentions: true, reposts: false,
    goals: true, kickoff: true, results: true, transfers: false,
    push: true, email_notif: false,
  })

  const toggle = id => setPrefs(p => ({ ...p, [id]: !p[id] }))

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <SectionHeader icon={Bell} title="Notifications" description="Choose what you get notified about and how." />
      <div className="space-y-6">
        {NOTIF_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">{group.label}</p>
            <div className="card overflow-hidden">
              {group.items.map((item, i) => (
                <div
                  key={item.id}
                  className={clsx(
                    'flex items-center justify-between gap-4 px-4 py-3.5',
                    i < group.items.length - 1 && 'border-b',
                  )}
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.label}</p>
                    <p className="text-xs text-muted mt-0.5">{item.hint}</p>
                  </div>
                  <Toggle checked={prefs[item.id]} onChange={() => toggle(item.id)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SaveRow onSave={handleSave} saved={saved} />
    </div>
  )
}

// ─── Appearance ──────────────────────────────────────────────────────────────
const THEMES = [
  { value: 'light', icon: Sun,     label: 'Light' },
  { value: 'dark',  icon: Moon,    label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'sw', label: 'Kiswahili' },
]

function AppearanceSection() {
  const { theme, toggleTheme } = useTheme()
  const [saved, setSaved] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState(theme === 'dark' ? 'dark' : 'light')
  const [language, setLanguage] = useState('en')
  const [fontSize, setFontSize] = useState('default')

  const applyTheme = (val) => {
    setSelectedTheme(val)
    if (val === 'dark' && theme !== 'dark') toggleTheme()
    if (val === 'light' && theme === 'dark') toggleTheme()
    // 'system' just uses the system value, treat as light for demo
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <SectionHeader icon={Palette} title="Appearance" description="Customise how Ball looks for you." />

      {/* Theme picker */}
      <div className="mb-6">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => applyTheme(value)}
              className={clsx(
                'flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-sm',
                selectedTheme === value
                  ? 'border-green-600 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                  : 'border-transparent hover:border-[var(--border)]',
              )}
              style={selectedTheme !== value ? { background: 'var(--card)', color: 'var(--text-muted)' } : {}}
            >
              <Icon size={22} />
              {label}
              {selectedTheme === value && <Check size={14} className="text-green-600 dark:text-green-400" />}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t mb-6" style={{ borderColor: 'var(--border)' }} />

      {/* Language */}
      <FormRow label="Language" hint="Display language for the app.">
        <div className="relative">
          <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <select
            className="input pl-9 appearance-none cursor-pointer"
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </FormRow>

      {/* Font size */}
      <FormRow label="Feed density" hint="Controls post spacing in your feed.">
        <div className="flex gap-2">
          {['compact', 'default', 'comfortable'].map(s => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              className={clsx(
                'flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-all',
                fontSize === s
                  ? 'border-green-600 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                  : 'border-[var(--border)] text-muted hover:text-[var(--text)]',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </FormRow>

      <SaveRow onSave={handleSave} saved={saved} />
    </div>
  )
}

// ─── Security ────────────────────────────────────────────────────────────────
const MOCK_SESSIONS = [
  { id: 1, device: 'Chrome on macOS', location: 'London, UK',   last_active: 'Active now',      icon: Laptop,      current: true },
  { id: 2, device: 'Ball iOS App',    location: 'London, UK',   last_active: '2 hours ago',     icon: Smartphone,  current: false },
  { id: 3, device: 'Firefox on Windows', location: 'Manchester, UK', last_active: '3 days ago', icon: Monitor,     current: false },
]

const BACKUP_CODES = ['B3KF-7QXA', 'N9PL-2MWY', 'T4CJ-8RVZ', 'H6DS-1ENK', 'W2XB-5GTF', 'A7QM-3PHC']

function SecuritySection() {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFAFlow, setTwoFAFlow]   = useState(false) // show setup flow
  const [sessions, setSessions]     = useState(MOCK_SESSIONS)
  const [copiedCode, setCopiedCode] = useState(null)

  const revokeSession = (id) => setSessions(s => s.filter(sess => sess.id !== id))

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="space-y-8">
      <SectionHeader icon={Shield} title="Security" description="Keep your account safe." />

      {/* 2FA */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Two-factor authentication</p>
            <p className="text-xs text-muted mt-0.5">Add an extra layer of security to your account using an authenticator app.</p>
          </div>
          <Toggle
            checked={twoFAEnabled}
            onChange={(v) => { setTwoFAEnabled(v); if (v) setTwoFAFlow(true) }}
          />
        </div>

        {twoFAFlow && (
          <div className="card p-5 animate-fade-in space-y-5" style={{ background: 'var(--card)' }}>
            <div className="flex items-start gap-4">
              {/* Mock QR code */}
              <div className="w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden border-2 border-green-600">
                <svg viewBox="0 0 100 100" className="w-full h-full" style={{ background: '#fff' }}>
                  {/* Simplified QR-like pattern */}
                  {Array.from({ length: 10 }, (_, row) =>
                    Array.from({ length: 10 }, (_, col) => {
                      const fill = (row + col * 3 + row * col) % 3 === 0
                      return fill ? <rect key={`${row}-${col}`} x={col * 9 + 5} y={row * 9 + 5} width={8} height={8} fill="#16a34a" /> : null
                    })
                  )}
                  {/* Corner finders */}
                  <rect x="5" y="5" width="27" height="27" rx="2" fill="none" stroke="#16a34a" strokeWidth="3" />
                  <rect x="68" y="5" width="27" height="27" rx="2" fill="none" stroke="#16a34a" strokeWidth="3" />
                  <rect x="5" y="68" width="27" height="27" rx="2" fill="none" stroke="#16a34a" strokeWidth="3" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Scan with your authenticator</p>
                <p className="text-xs text-muted leading-relaxed">
                  Use Google Authenticator, Authy, or any TOTP app to scan this QR code. Then enter the 6-digit code to confirm.
                </p>
                <div className="mt-3">
                  <p className="text-xs text-muted mb-1">Or enter manually:</p>
                  <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded select-all" style={{ color: 'var(--text)' }}>
                    BALL-TOTP-XKCD-4829
                  </code>
                </div>
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Enter the 6-digit code from your app</label>
              <div className="flex gap-2">
                <input className="input font-mono tracking-[0.4em] text-center" placeholder="000000" maxLength={6} />
                <button
                  className="btn-primary px-5"
                  onClick={() => { setTwoFAFlow(false) }}
                >
                  Verify
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>Backup codes</p>
              <p className="text-xs text-muted mb-3">Save these somewhere safe. Each code can be used once if you lose access to your authenticator.</p>
              <div className="grid grid-cols-2 gap-2">
                {BACKUP_CODES.map(code => (
                  <button
                    key={code}
                    onClick={() => copyCode(code)}
                    className="flex items-center justify-between gap-2 font-mono text-xs px-3 py-2 rounded-lg border transition-colors hover:border-green-600"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    {code}
                    {copiedCode === code
                      ? <CheckCheck size={13} className="text-green-500" />
                      : <Copy size={13} className="text-muted" />
                    }
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {twoFAEnabled && !twoFAFlow && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mt-2">
            <Check size={15} />
            Two-factor authentication is active
          </div>
        )}
      </div>

      <div className="border-t" style={{ borderColor: 'var(--border)' }} />

      {/* Active sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Active sessions</p>
            <p className="text-xs text-muted mt-0.5">These devices are currently signed in to your account.</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          {sessions.map((sess, i) => {
            const Icon = sess.icon
            return (
              <div
                key={sess.id}
                className={clsx('flex items-center gap-3 px-4 py-3.5', i < sessions.length - 1 && 'border-b')}
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--surface)' }}>
                  <Icon size={18} className="text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{sess.device}</p>
                    {sess.current && (
                      <span className="badge badge-green text-[10px] flex-shrink-0">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-muted">{sess.location} · {sess.last_active}</p>
                </div>
                {!sess.current && (
                  <button
                    onClick={() => revokeSession(sess.id)}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 flex-shrink-0 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────
function ConfirmDialog({ title, description, confirmLabel, confirmClass = 'bg-red-600 hover:bg-red-700 text-white', onConfirm, onCancel, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative card p-6 w-full max-w-sm animate-fade-in" style={{ background: 'var(--card)' }}>
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
        <p className="text-sm text-muted mb-4">{description}</p>
        {children}
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            className={clsx('flex-1 font-semibold px-4 py-2 rounded-lg transition-all duration-150 active:scale-95', confirmClass)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function DangerZoneSection() {
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const [dialog, setDialog] = useState(null) // 'logout-all' | 'delete'
  const [deleteInput, setDeleteInput] = useState('')

  const handleLogoutAll = () => {
    logout()
    navigate('/login')
  }

  const handleDelete = () => {
    if (deleteInput !== CURRENT_USER.username) return
    logout()
    navigate('/login')
  }

  return (
    <div>
      <SectionHeader icon={AlertTriangle} title="Danger Zone" description="Irreversible and destructive actions." />

      <div className="space-y-3">
        {/* Logout all */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-orange-200 dark:border-orange-900/50 p-4"
          style={{ background: 'rgba(251,146,60,0.04)' }}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Sign out of all devices</p>
            <p className="text-xs text-muted mt-0.5">Revoke all active sessions and sign you out everywhere.</p>
          </div>
          <button
            onClick={() => setDialog('logout-all')}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-400 text-orange-600 dark:text-orange-400 dark:border-orange-700 font-semibold text-sm hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
          >
            <LogOut size={15} />
            Sign out all
          </button>
        </div>

        {/* Delete account */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900/50 p-4"
          style={{ background: 'rgba(239,68,68,0.04)' }}
        >
          <div>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">Delete account</p>
            <p className="text-xs text-muted mt-0.5">Permanently delete your account, posts, and all data. This cannot be undone.</p>
          </div>
          <button
            onClick={() => setDialog('delete')}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
          >
            <Trash2 size={15} />
            Delete account
          </button>
        </div>
      </div>

      {/* Dialogs */}
      {dialog === 'logout-all' && (
        <ConfirmDialog
          title="Sign out of all devices?"
          description="You will be signed out of every active session, including this one."
          confirmLabel="Sign out all"
          confirmClass="bg-orange-500 hover:bg-orange-600 text-white"
          onConfirm={handleLogoutAll}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'delete' && (
        <ConfirmDialog
          title="Delete your account?"
          description={`This will permanently delete @${CURRENT_USER.username} and all associated data. Type your username to confirm.`}
          confirmLabel="Delete account"
          onConfirm={handleDelete}
          onCancel={() => { setDialog(null); setDeleteInput('') }}
        >
          <input
            className="input mb-4"
            placeholder={`Type "${CURRENT_USER.username}" to confirm`}
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
          />
        </ConfirmDialog>
      )}
    </div>
  )
}

// ─── Main Settings page ──────────────────────────────────────────────────────
const SECTION_MAP = {
  profile:       EditProfileSection,
  account:       AccountSection,
  notifications: NotificationsSection,
  appearance:    AppearanceSection,
  security:      SecuritySection,
  danger:        DangerZoneSection,
}

export default function Settings() {
  const [active, setActive] = useState('profile')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const ActiveSection = SECTION_MAP[active]
  const activeLabel   = SECTIONS.find(s => s.id === active)?.label

  const goTo = (id) => { setActive(id); setMobileMenuOpen(false) }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      {/* Page title */}
      <h1 className="text-2xl font-black mb-6" style={{ color: 'var(--text)' }}>Settings</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Sidebar ── */}
        <aside className="lg:w-52 flex-shrink-0">
          {/* Mobile section picker */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border font-semibold text-sm"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <span className="flex items-center gap-2">
                {(() => { const s = SECTIONS.find(s => s.id === active); return s ? <s.icon size={16} /> : null })()}
                {activeLabel}
              </span>
              <ChevronRight size={16} className={clsx('transition-transform', mobileMenuOpen && 'rotate-90')} />
            </button>
            {mobileMenuOpen && (
              <div className="mt-1 card overflow-hidden animate-fade-in">
                {SECTIONS.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => goTo(id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left border-b last:border-b-0 transition-colors',
                      active === id ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30' : 'text-muted hover:text-[var(--text)]',
                    )}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <Icon size={16} />
                    {label}
                    {active === id && <Check size={14} className="ml-auto text-green-600 dark:text-green-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex flex-col gap-0.5">
            {SECTIONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={clsx(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150',
                  active === id
                    ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-semibold'
                    : 'text-muted hover:text-[var(--text)] hover:bg-[var(--card)]',
                  id === 'danger' && active !== 'danger' && 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20',
                )}
              >
                <Icon size={17} strokeWidth={1.9} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 card p-5 sm:p-7 animate-fade-in" key={active}>
          <ActiveSection />
        </div>
      </div>
    </div>
  )
}

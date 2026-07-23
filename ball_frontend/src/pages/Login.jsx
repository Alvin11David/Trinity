import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Eye, EyeOff, Sun, Moon, Loader2 } from 'lucide-react'
import { CURRENT_USER } from '../utils/mock'

export default function Login() {
  const { login } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.username || !form.password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    // Mock auth — replace with POST /api/users/login/
    if (form.password.length < 4) {
      setError('Invalid credentials. Please try again.')
      setLoading(false)
      return
    }
    login({ ...CURRENT_USER, username: form.username })
    navigate('/')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12 bg-green-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)', backgroundSize: '80px 80px' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-white text-xl font-black">B</span>
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Ball</span>
          </div>
          <h1 className="text-4xl font-black leading-tight mb-4">
            The social network<br />built for football.
          </h1>
          <p className="text-green-100 text-lg font-medium leading-relaxed">
            Live scores, match discussions, AI insights, and a community of fans — all in one place.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          {[
            { icon: '⚽', text: 'Live match updates & scores' },
            { icon: '🧠', text: 'Winnie AI — real-time analysis' },
            { icon: '👥', text: 'Follow fans, teams & leagues' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span className="text-green-100 font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2.5 rounded-xl border transition-colors hover:border-green-500"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white font-black">B</span>
            </div>
            <span className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Ball</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Welcome back</h2>
          <p className="text-sm text-muted mb-8">Sign in to your Ball account.</p>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-medium mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Username</label>
              <input
                type="text"
                className="input"
                placeholder="your_username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-green-600 transition-colors"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-muted">
            Don't have an account?{' '}
            <Link to="/register" className="link">Create one</Link>
          </p>

          {/* Demo hint */}
          <div
            className="mt-8 rounded-xl p-3.5 text-xs text-muted"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--text)' }}>Demo tip:</span>{' '}
            Enter any username and a password of 4+ characters to log in.
          </div>
        </div>
      </div>
    </div>
  )
}

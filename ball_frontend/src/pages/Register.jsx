import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Eye, EyeOff, Sun, Moon, Loader2, Check } from 'lucide-react'
import { CURRENT_USER } from '../utils/mock'

const STEPS = ['Account', 'Profile', 'Done']

export default function Register() {
  const { login } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username: '', email: '', password: '', first_name: '', last_name: '', bio: '', favorite_club: '',
  })

  const handleNext = async (e) => {
    e.preventDefault()
    if (step < 1) { setStep(s => s + 1); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    login({ ...CURRENT_USER, ...form })
    navigate('/')
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'var(--bg)' }}>
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2.5 rounded-xl border transition-colors hover:border-green-500"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow">
            <span className="text-white font-black text-lg">B</span>
          </div>
          <span className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Ball</span>
        </div>

        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Create your account</h2>
        <p className="text-sm text-muted mb-6">Join the football community.</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-green-600 text-white ring-4 ring-green-200 dark:ring-green-900' : 'bg-gray-200 dark:bg-gray-700 text-muted'}`}>
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <span className={`text-xs font-semibold ${i === step ? 'text-green-600 dark:text-green-400' : 'text-muted'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleNext} className="space-y-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">First Name</label>
                  <input className="input" placeholder="Kwame" value={form.first_name} onChange={set('first_name')} />
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input className="input" placeholder="Asante" value={form.last_name} onChange={set('last_name')} />
                </div>
              </div>
              <div>
                <label className="form-label">Username</label>
                <input className="input" placeholder="kwame_fc" value={form.username} onChange={set('username')} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="input" placeholder="kwame@example.com" value={form.email} onChange={set('email')} />
              </div>
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} className="input pr-11" placeholder="••••••••" value={form.password} onChange={set('password')} />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-green-600">
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="form-label">Bio <span className="text-muted font-normal">(optional)</span></label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Tell the football world about yourself…"
                  value={form.bio}
                  onChange={set('bio')}
                  maxLength={280}
                />
                <p className="text-xs text-muted mt-1 text-right">{form.bio.length}/280</p>
              </div>
              <div>
                <label className="form-label">Favourite Club <span className="text-muted font-normal">(optional)</span></label>
                <input className="input" placeholder="e.g. Arsenal" value={form.favorite_club} onChange={set('favorite_club')} />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-60"
          >
            {loading && <Loader2 size={17} className="animate-spin" />}
            {step < 1 ? 'Continue' : loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="text-sm text-muted hover:text-green-600 mt-3 font-medium block mx-auto">
            ← Back
          </button>
        )}

        <p className="text-sm text-center mt-6 text-muted">
          Already have an account?{' '}
          <Link to="/login" className="link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

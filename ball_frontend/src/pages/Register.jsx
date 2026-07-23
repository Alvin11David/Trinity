import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Eye, EyeOff, Sun, Moon, Loader2, Check } from 'lucide-react'
import { CURRENT_USER } from '../utils/mock'

const STEPS = ['Account', 'Profile', 'Done']

/* ─── Floating-label input ─────────────────────────────────────────────── */
function FloatInput({ id, label, type = 'text', value, onChange, suffix, autoComplete }) {
  const [focused, setFocused] = useState(false)
  const lifted = focused || value.length > 0

  return (
    <div
      className="relative rounded-xl"
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--border)'}`,
        boxShadow: focused ? '0 0 0 3px rgba(22,163,74,0.25)' : 'none',
      }}
    >
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        className="peer w-full px-4 pt-6 pb-2.5 text-sm font-medium outline-none transition-all duration-200"
        style={{ background: 'transparent', color: 'var(--text)' }}
        placeholder=" "
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-4 font-medium transition-all duration-200 origin-left"
        style={{
          top: lifted ? '8px' : '50%',
          transform: lifted ? 'translateY(0) scale(0.78)' : 'translateY(-50%) scale(1)',
          color: focused ? 'var(--primary)' : 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        {label}
      </label>
      {suffix && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{suffix}</div>
      )}
    </div>
  )
}

/* ─── Floating-label textarea ───────────────────────────────────────────── */
function FloatTextarea({ id, label, value, onChange, maxLength, rows = 3 }) {
  const [focused, setFocused] = useState(false)
  const lifted = focused || value.length > 0

  return (
    <div
      className="relative rounded-xl"
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--border)'}`,
        boxShadow: focused ? '0 0 0 3px rgba(22,163,74,0.25)' : 'none',
      }}
    >
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        maxLength={maxLength}
        className="peer w-full px-4 pt-7 pb-3 text-sm font-medium outline-none transition-all duration-200 resize-none"
        style={{ background: 'transparent', color: 'var(--text)' }}
        placeholder=" "
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-4 font-medium transition-all duration-200 origin-left"
        style={{
          top: lifted ? '10px' : '20px',
          transform: lifted ? 'translateY(0) scale(0.78)' : 'translateY(0) scale(1)',
          color: focused ? 'var(--primary)' : 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        {label}
      </label>
    </div>
  )
}

/* ─── Football pitch SVG ────────────────────────────────────────────────── */
function PitchOverlay() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 480 720"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="white" strokeWidth="1.5" opacity="0.12">
        {/* Outer boundary */}
        <rect x="40" y="60" width="400" height="600" rx="2" />
        {/* Halfway line */}
        <line x1="40" y1="360" x2="440" y2="360" />
        {/* Centre circle */}
        <circle cx="240" cy="360" r="70" />
        {/* Centre spot */}
        <circle cx="240" cy="360" r="3" fill="white" stroke="none" opacity="0.25" />
        {/* Top penalty area */}
        <rect x="120" y="60" width="240" height="110" />
        {/* Top 6-yard box */}
        <rect x="170" y="60" width="140" height="50" />
        {/* Top penalty spot */}
        <circle cx="240" cy="170" r="3" fill="white" stroke="none" opacity="0.25" />
        {/* Top penalty arc */}
        <path d="M 175 170 A 70 70 0 0 1 305 170" strokeDasharray="4 3" />
        {/* Bottom penalty area */}
        <rect x="120" y="550" width="240" height="110" />
        {/* Bottom 6-yard box */}
        <rect x="170" y="610" width="140" height="50" />
        {/* Bottom penalty spot */}
        <circle cx="240" cy="550" r="3" fill="white" stroke="none" opacity="0.25" />
        {/* Bottom penalty arc */}
        <path d="M 175 550 A 70 70 0 0 0 305 550" strokeDasharray="4 3" />
        {/* Corner arcs */}
        <path d="M 40 76 A 16 16 0 0 1 56 60" />
        <path d="M 424 60 A 16 16 0 0 1 440 76" />
        <path d="M 40 644 A 16 16 0 0 0 56 660" />
        <path d="M 424 660 A 16 16 0 0 0 440 644" />
      </g>
    </svg>
  )
}

/* ─── Floating team logo orbs ───────────────────────────────────────────── */
const ORBS = [
  { src: 'https://media.api-sports.io/football/teams/33.png',  top: '10%', left: '10%', size: 48, delay: '0s',   dur: '8s'  },
  { src: 'https://media.api-sports.io/football/teams/50.png',  top: '28%', left: '72%', size: 40, delay: '1.4s', dur: '9s'  },
  { src: 'https://media.api-sports.io/football/teams/85.png',  top: '52%', left: '8%',  size: 44, delay: '2.3s', dur: '7s'  },
  { src: 'https://media.api-sports.io/football/teams/496.png', top: '70%', left: '65%', size: 36, delay: '0.9s', dur: '11s' },
  { src: 'https://media.api-sports.io/football/teams/165.png', top: '84%', left: '22%', size: 42, delay: '3.1s', dur: '10s' },
]

function FloatingOrbs() {
  return (
    <>
      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-14px) rotate(3deg); }
          66%       { transform: translateY(8px) rotate(-3deg); }
        }
      `}</style>
      {ORBS.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center overflow-hidden"
          style={{
            top: orb.top, left: orb.left,
            width: orb.size, height: orb.size,
            animation: `floatOrb ${orb.dur} ${orb.delay} ease-in-out infinite`,
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '6px',
          }}
        >
          <img
            src={orb.src}
            alt=""
            className="w-full h-full object-contain"
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      ))}
    </>
  )
}

/* ─── Live ticker ───────────────────────────────────────────────────────── */
const SCORES = [
  'Arsenal 2–1 Liverpool  •  67\'',
  'Barcelona 3–2 Real Madrid  •  FT',
  'Man City 0–0 Chelsea  •  34\'',
  'Bayern 1–1 Dortmund  •  HT',
  'PSG 2–0 Lyon  •  89\'',
]

function LiveTicker() {
  return (
    <>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker 22s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="overflow-hidden whitespace-nowrap border-t border-white/15 pt-3">
        <div className="flex ticker-track w-max gap-10 text-xs font-semibold text-white/70">
          {[...SCORES, ...SCORES].map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse" />
              {s}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}

/* ─── Step indicator ────────────────────────────────────────────────────── */
function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2 flex-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < step
                ? 'bg-green-600 text-white'
                : i === step
                ? 'bg-green-600 text-white ring-4 ring-green-200 dark:ring-green-900'
                : 'text-muted'
            }`}
            style={i >= step && i !== step ? { background: 'var(--border)' } : {}}
          >
            {i < step ? <Check size={13} /> : i + 1}
          </div>
          <span
            className={`text-xs font-semibold ${
              i === step ? 'text-green-600 dark:text-green-400' : 'text-muted'
            }`}
          >
            {s}
          </span>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Main Register page ────────────────────────────────────────────────── */
export default function Register() {
  const { login } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState({
    username: '', email: '', password: '',
    first_name: '', last_name: '', bio: '', favorite_club: '',
  })

  // Slide-in trigger
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

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
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[460px] shrink-0 p-12 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #15803d 0%, #166534 55%, #14532d 100%)' }}
      >
        <PitchOverlay />
        <FloatingOrbs />

        {/* Top section */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
              <span className="text-white text-xl font-black">B</span>
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Ball</span>
          </div>

          <h1 className="text-[2.6rem] font-black leading-[1.15] mb-5 tracking-tight">
            Join the world's<br />biggest football<br />
            <span className="text-green-300">community.</span>
          </h1>
          <p className="text-white/70 text-base font-medium leading-relaxed max-w-xs">
            Set up your profile in under a minute and connect with 2.4&nbsp;million fans worldwide.
          </p>

          {/* Stat strip */}
          <div className="flex gap-6 mt-8">
            {[['2.4M', 'Fans'], ['140+', 'Countries'], ['1,200', 'Live matches']].map(([val, lbl]) => (
              <div key={lbl}>
                <p className="text-xl font-black text-white">{val}</p>
                <p className="text-xs text-white/50 font-medium">{lbl}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom section */}
        <div className="relative z-10 space-y-4">
          <div className="space-y-3 mb-5">
            {[
              { icon: '⚽', text: 'Live match updates & scores' },
              { icon: '🧠', text: 'Winnie AI — real-time analysis' },
              { icon: '👥', text: 'Follow fans, teams & leagues' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-white/80 font-medium text-sm">{item.text}</span>
              </div>
            ))}
          </div>
          <LiveTicker />
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">

        {/* Subtle bg decorations */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #16a34a, transparent)', transform: 'translate(40%, -40%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #16a34a, transparent)', transform: 'translate(-40%, 40%)' }}
        />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2.5 rounded-xl border transition-all hover:border-green-500 hover:text-green-600"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Slide-in wrapper */}
        <div
          className="w-full max-w-sm transition-all duration-500 ease-out"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow">
              <span className="text-white font-black">B</span>
            </div>
            <span className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Ball</span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--text)' }}>
              Create your account
            </h2>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Join the football community — it's free.
            </p>
          </div>

          {/* Step indicator */}
          <StepIndicator step={step} />

          {/* Form */}
          <form onSubmit={handleNext} className="space-y-4">
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FloatInput
                    id="first_name"
                    label="First Name"
                    value={form.first_name}
                    onChange={set('first_name')}
                    autoComplete="given-name"
                  />
                  <FloatInput
                    id="last_name"
                    label="Last Name"
                    value={form.last_name}
                    onChange={set('last_name')}
                    autoComplete="family-name"
                  />
                </div>

                <FloatInput
                  id="username"
                  label="Username"
                  value={form.username}
                  onChange={set('username')}
                  autoComplete="username"
                />

                <FloatInput
                  id="email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                />

                <FloatInput
                  id="password"
                  label="Password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="text-muted hover:text-green-600 transition-colors p-0.5"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <FloatTextarea
                    id="bio"
                    label="Bio (optional)"
                    value={form.bio}
                    onChange={set('bio')}
                    maxLength={280}
                    rows={3}
                  />
                  <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
                    {form.bio.length}/280
                  </p>
                </div>

                <FloatInput
                  id="favorite_club"
                  label="Favourite Club (optional)"
                  value={form.favorite_club}
                  onChange={set('favorite_club')}
                  autoComplete="off"
                />
              </>
            )}

            {/* Glowing CTA */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: loading ? '#15803d' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(22,163,74,0.45)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 32px rgba(22,163,74,0.65)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(22,163,74,0.45)' }}
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {step < 1 ? 'Continue' : loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Back link */}
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-sm font-semibold mt-3 block mx-auto hover:underline transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back
            </button>
          )}

          {/* Sign-in link */}
          <p className="text-sm text-center mt-6 font-medium" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="link font-bold">Sign in</Link>
          </p>

          {/* Demo hint */}
          <div
            className="mt-6 rounded-xl p-3.5 text-xs flex items-start gap-2"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <span>💡</span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Demo:</strong> fill any values — no real account is created.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { Eye, EyeOff, Sun, Moon, Loader2, ArrowLeft, RotateCcw } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   Shared: FloatInput
───────────────────────────────────────────────────────────────────────────── */
function FloatInput({ id, label, type = 'text', value, onChange, suffix, autoComplete }) {
  const [focused, setFocused] = useState(false)
  const lifted = focused || value.length > 0
  return (
    <div className="relative">
      <input
        id={id} type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        autoComplete={autoComplete || type}
        className="peer w-full rounded-xl px-4 pt-6 pb-2.5 text-sm font-medium outline-none transition-all duration-200"
        style={{
          background: 'var(--surface)',
          border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--border)'}`,
          color: 'var(--text)',
          boxShadow: focused ? '0 0 0 3px rgba(22,163,74,0.12)' : 'none',
        }}
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
      {suffix && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{suffix}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared: Pitch lines background
───────────────────────────────────────────────────────────────────────────── */
function PitchLines() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 460 720"
      preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <g stroke="white" strokeWidth="1.5" opacity="0.08">
        <rect x="30" y="60" width="400" height="600" rx="2" />
        <line x1="30" y1="360" x2="430" y2="360" />
        <circle cx="230" cy="360" r="70" />
        <rect x="110" y="60" width="240" height="110" />
        <rect x="160" y="60" width="140" height="50" />
        <rect x="110" y="550" width="240" height="110" />
        <rect x="160" y="610" width="140" height="50" />
      </g>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE 1 — Striker lining up a shot (Enter email)
   "Take a shot at your inbox"
   Animation: player winds up → kicks → ball rolls → loops
───────────────────────────────────────────────────────────────────────────── */
function ShootScene() {
  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-8 gap-8">
      <style>{`
        @keyframes fp-kickLeg {
          0%,100% { transform: rotate(0deg); }
          30%      { transform: rotate(-30deg); }   /* wind back */
          55%      { transform: rotate(32deg); }    /* kick through */
          80%      { transform: rotate(5deg); }     /* follow-through */
        }
        @keyframes fp-kickArm {
          0%,100% { transform: rotate(0deg); }
          30%      { transform: rotate(20deg); }
          55%      { transform: rotate(-18deg); }
        }
        @keyframes fp-ballRoll {
          0%,28%   { transform: translateX(0); }
          55%      { transform: translateX(0); }
          100%     { transform: translateX(72px); }
        }
        @keyframes fp-ballSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fp-bodyBob {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes fp-goalGlow {
          0%,100% { opacity: 0.18; }
          50%      { opacity: 0.38; }
        }
        .fp-kick-leg  { transform-origin: 155px 178px; animation: fp-kickLeg 1.9s ease-in-out infinite; }
        .fp-kick-arm  { transform-origin: 148px 148px; animation: fp-kickArm 1.9s ease-in-out infinite; }
        .fp-ball-roll { animation: fp-ballRoll 1.9s ease-in-out infinite; }
        .fp-ball-spin { animation: fp-ballSpin 1.4s linear infinite; }
        .fp-body-bob  { animation: fp-bodyBob 1.9s ease-in-out infinite; }
        .fp-goal-glow { animation: fp-goalGlow 2.4s ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 300 260" className="w-full max-w-[300px]" aria-label="Footballer about to shoot">

        {/* ── Goal post (background) ── */}
        <g className="fp-goal-glow">
          <rect x="30" y="80" width="100" height="70" rx="2"
            fill="none" stroke="white" strokeWidth="3.5" strokeLinejoin="round" />
          {/* Net lines horizontal */}
          {[92,104,116,128,140].map(y => (
            <line key={y} x1="30" y1={y} x2="130" y2={y} stroke="white" strokeWidth="0.8" opacity="0.5" />
          ))}
          {/* Net lines vertical */}
          {[46,62,78,94,110,126].map(x => (
            <line key={x} x1={x} y1="80" x2={x} y2="150" stroke="white" strokeWidth="0.8" opacity="0.5" />
          ))}
        </g>
        {/* Goal posts solid */}
        <rect x="30" y="80" width="100" height="70" rx="2"
          fill="none" stroke="white" strokeWidth="3.5" />

        {/* Ground */}
        <line x1="20" y1="220" x2="280" y2="220" stroke="white" strokeWidth="2" opacity="0.3" />

        {/* ── Football ── */}
        <g className="fp-ball-roll" style={{ transformOrigin: '185px 208px' }}>
          <g className="fp-ball-spin" style={{ transformOrigin: '185px 208px' }}>
            <circle cx="185" cy="208" r="16" fill="white" />
            {/* Pentagon patches */}
            <circle cx="185" cy="208" r="5" fill="#1a1a1a" />
            <polygon points="185,196 190,200 188,206 182,206 180,200" fill="#1a1a1a" opacity="0.6" />
            <polygon points="197,210 202,214 200,220 194,220 192,214" fill="#1a1a1a" opacity="0.6" />
            <polygon points="173,210 168,214 170,220 176,220 178,214" fill="#1a1a1a" opacity="0.6" />
          </g>
        </g>

        {/* ── Player body ── */}
        <g className="fp-body-bob">
          {/* Standing leg */}
          <line x1="148" y1="195" x2="140" y2="220" stroke="white" strokeWidth="7" strokeLinecap="round" />
          <line x1="140" y1="220" x2="134" y2="220" stroke="white" strokeWidth="5" strokeLinecap="round" />

          {/* Kicking leg (animated) */}
          <g className="fp-kick-leg">
            <line x1="155" y1="178" x2="162" y2="205" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" />
            <line x1="162" y1="205" x2="174" y2="210" stroke="#4ade80" strokeWidth="5" strokeLinecap="round" />
          </g>

          {/* Torso (jersey #10) */}
          <rect x="132" y="138" width="36" height="48" rx="10"
            fill="#16a34a" stroke="white" strokeWidth="2.5" />
          <text x="150" y="166" textAnchor="middle" fill="white"
            fontSize="11" fontWeight="900" fontFamily="Inter,sans-serif">10</text>

          {/* Back arm */}
          <line x1="132" y1="148" x2="118" y2="168" stroke="white" strokeWidth="6" strokeLinecap="round" />

          {/* Front arm (animated) */}
          <g className="fp-kick-arm">
            <line x1="148" y1="148" x2="166" y2="163" stroke="white" strokeWidth="6" strokeLinecap="round" />
          </g>

          {/* Head */}
          <circle cx="150" cy="118" r="22" fill="#FBBF24" stroke="white" strokeWidth="2.5" />
          {/* Hair */}
          <rect x="130" y="100" width="40" height="10" rx="5" fill="#92400e" />
          {/* Eyes */}
          <circle cx="143" cy="116" r="3" fill="#1a1a1a" />
          <circle cx="157" cy="116" r="3" fill="#1a1a1a" />
          {/* Focused expression - eyebrows */}
          <line x1="140" y1="111" x2="146" y2="113" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <line x1="154" y1="113" x2="160" y2="111" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          {/* Grin */}
          <path d="M 144 124 Q 150 129 156 124" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Motion lines from ball */}
        <line x1="200" y1="202" x2="218" y2="200" stroke="white" strokeWidth="1.5" opacity="0.4" strokeDasharray="3 3" />
        <line x1="202" y1="210" x2="222" y2="209" stroke="white" strokeWidth="1.5" opacity="0.3" strokeDasharray="3 3" />
      </svg>

      <div className="text-center text-white relative z-10">
        <p className="text-2xl font-black leading-tight mb-1.5">Take a shot!</p>
        <p className="text-white/65 text-sm font-medium leading-snug">
          Enter your email and we'll send<br />a reset link straight to your inbox
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE 2 — Ball flying into an envelope / goal net (Email sent)
   "Goal! Check your inbox"
   Animation: ball arcs in, envelope bounces, net ripples
───────────────────────────────────────────────────────────────────────────── */
function GoalScene() {
  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-8 gap-8">
      <style>{`
        @keyframes fp-arc {
          0%   { transform: translate(0, 0) rotate(0deg); opacity:1; }
          60%  { transform: translate(-110px, -60px) rotate(200deg); opacity:1; }
          80%  { transform: translate(-110px, -60px) rotate(220deg); opacity:1; }
          100% { transform: translate(-110px, -60px) rotate(220deg); opacity:0.9; }
        }
        @keyframes fp-envBounce {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes fp-netRipple {
          0%,100% { d: path("M 90 136 Q 130 148 170 136 Q 130 152 90 136"); }
          50%      { d: path("M 90 136 Q 130 158 170 136 Q 130 162 90 136"); }
        }
        @keyframes fp-goalText {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
        @keyframes fp-starPop {
          0%   { opacity:0; transform: scale(0) rotate(0deg); }
          40%  { opacity:1; transform: scale(1.2) rotate(20deg); }
          100% { opacity:0; transform: scale(0.8) rotate(40deg) translateY(-20px); }
        }
        .fp-ball-arc  { animation: fp-arc 2.2s ease-in-out infinite; }
        .fp-env-b     { animation: fp-envBounce 1.8s ease-in-out infinite; }
        .fp-goal-txt  { animation: fp-goalText 1.8s ease-in-out infinite; }
        .fp-star1     { animation: fp-starPop 2.2s 0.3s ease-out infinite; transform-origin: center; }
        .fp-star2     { animation: fp-starPop 2.2s 0.7s ease-out infinite; transform-origin: center; }
        .fp-star3     { animation: fp-starPop 2.2s 1.1s ease-out infinite; transform-origin: center; }
      `}</style>

      <svg viewBox="0 0 300 260" className="w-full max-w-[300px]" aria-label="Ball flying into inbox">

        {/* Stars */}
        <text className="fp-star1" x="52" y="72" fontSize="18" fill="#FDE047">★</text>
        <text className="fp-star2" x="235" y="65" fontSize="14" fill="#FDE047">★</text>
        <text className="fp-star3" x="220" y="100" fontSize="10" fill="#FDE047">✦</text>

        {/* GOAL banner */}
        <g className="fp-goal-txt" style={{ transformOrigin: '150px 55px' }}>
          <rect x="88" y="36" width="124" height="36" rx="8" fill="#FDE047" />
          <text x="150" y="60" textAnchor="middle" fill="#14532d"
            fontSize="20" fontWeight="900" fontFamily="Inter,sans-serif" letterSpacing="2">
            GOAL!
          </text>
        </g>

        {/* ── Envelope ── */}
        <g className="fp-env-b" style={{ transformOrigin: '130px 168px' }}>
          {/* Body */}
          <rect x="72" y="136" width="116" height="84" rx="8" fill="white" />
          {/* Flap */}
          <path d="M 72 136 L 130 178 L 188 136 Z" fill="#dcfce7" />
          <path d="M 72 136 L 130 178 L 188 136" fill="none" stroke="#16a34a" strokeWidth="2" />
          {/* Bottom fold lines */}
          <line x1="72" y1="220" x2="102" y2="185" stroke="#16a34a" strokeWidth="1.5" opacity="0.5" />
          <line x1="188" y1="220" x2="158" y2="185" stroke="#16a34a" strokeWidth="1.5" opacity="0.5" />
          {/* @ symbol */}
          <text x="130" y="205" textAnchor="middle" fill="#16a34a"
            fontSize="22" fontWeight="900" fontFamily="Inter,sans-serif">@</text>
        </g>

        {/* ── Ball (arcs into envelope) ── */}
        <g className="fp-ball-arc" style={{ transformOrigin: '220px 195px' }}>
          <circle cx="220" cy="195" r="18" fill="white" />
          <circle cx="220" cy="195" r="5.5" fill="#1a1a1a" />
          <polygon points="220,183 224,188 222,194 218,194 216,188" fill="#1a1a1a" opacity="0.6" />
          <polygon points="230,197 234,202 232,207 227,207 226,202" fill="#1a1a1a" opacity="0.5" />
          <polygon points="210,197 206,202 208,207 213,207 214,202" fill="#1a1a1a" opacity="0.5" />
        </g>

        {/* Arc trajectory (dashed) */}
        <path d="M 218 190 Q 178 120 110 150" fill="none" stroke="white"
          strokeWidth="1.5" strokeDasharray="5 4" opacity="0.35" />

        {/* Ground */}
        <line x1="20" y1="228" x2="280" y2="228" stroke="white" strokeWidth="2" opacity="0.2" />
      </svg>

      <div className="text-center text-white relative z-10">
        <p className="text-2xl font-black leading-tight mb-1.5">It's in the net!</p>
        <p className="text-white/65 text-sm font-medium leading-snug">
          We've sent a 6-digit code to your inbox.<br />Check your email and come back here.
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE 3 — VAR referee checking a screen (Enter code)
   "The VAR's got your code"
   Animation: screen flickers, referee points, code digits blink
───────────────────────────────────────────────────────────────────────────── */
function VARScene() {
  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-8 gap-8">
      <style>{`
        @keyframes fp-varFlicker {
          0%,90%,100% { opacity:1; }
          93%          { opacity:0.5; }
          96%          { opacity:1; }
          98%          { opacity:0.7; }
        }
        @keyframes fp-refPoint {
          0%,100% { transform: rotate(-5deg); }
          50%      { transform: rotate(10deg); }
        }
        @keyframes fp-codeDigit {
          0%,100% { opacity:1; }
          50%      { opacity:0.3; }
        }
        @keyframes fp-headNod {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(2px); }
        }
        @keyframes fp-screenGlow {
          0%,100% { filter: drop-shadow(0 0 6px rgba(74,222,128,0.4)); }
          50%      { filter: drop-shadow(0 0 14px rgba(74,222,128,0.8)); }
        }
        .fp-var-flicker { animation: fp-varFlicker 3.5s ease-in-out infinite; }
        .fp-ref-point   { transform-origin: 198px 150px; animation: fp-refPoint 2s ease-in-out infinite; }
        .fp-d1 { animation: fp-codeDigit 1.2s 0.0s ease-in-out infinite; }
        .fp-d2 { animation: fp-codeDigit 1.2s 0.2s ease-in-out infinite; }
        .fp-d3 { animation: fp-codeDigit 1.2s 0.4s ease-in-out infinite; }
        .fp-d4 { animation: fp-codeDigit 1.2s 0.6s ease-in-out infinite; }
        .fp-d5 { animation: fp-codeDigit 1.2s 0.8s ease-in-out infinite; }
        .fp-d6 { animation: fp-codeDigit 1.2s 1.0s ease-in-out infinite; }
        .fp-nod { transform-origin: 118px 108px; animation: fp-headNod 2s ease-in-out infinite; }
        .fp-screen-glow { animation: fp-screenGlow 2s ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 300 265" className="w-full max-w-[300px]" aria-label="Referee checking VAR screen">

        {/* ── VAR Screen / monitor ── */}
        <g className="fp-screen-glow">
          {/* Screen stand */}
          <rect x="148" y="196" width="8" height="24" rx="2" fill="white" opacity="0.7" />
          <rect x="136" y="218" width="32" height="6" rx="3" fill="white" opacity="0.5" />
          {/* Screen body */}
          <rect x="82" y="88" width="140" height="108" rx="10" fill="#0f172a" stroke="white" strokeWidth="2.5" />
          {/* Screen inner */}
          <rect x="90" y="96" width="124" height="92" rx="6" fill="#052e16" />
          {/* VAR label */}
          <rect x="96" y="102" width="40" height="16" rx="4" fill="#16a34a" />
          <text x="116" y="114" textAnchor="middle" fill="white"
            fontSize="8" fontWeight="900" fontFamily="Inter,sans-serif">VAR</text>
          {/* Code label */}
          <text x="152" y="115" fill="#4ade80"
            fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">CODE:</text>
        </g>

        {/* Digits on screen */}
        <g className="fp-var-flicker">
          {['8','_','4','_','2','_'].map((d, i) => (
            <g key={i} className={`fp-d${i + 1}`}>
              <rect x={94 + i * 20} y="124" width="16" height="22" rx="4" fill="#16a34a" opacity="0.8" />
              <text x={102 + i * 20} y="140" textAnchor="middle" fill="white"
                fontSize="12" fontWeight="900" fontFamily="monospace">
                {d === '_' ? '•' : d}
              </text>
            </g>
          ))}
          {/* Scanning line */}
          <line x1="90" y1="158" x2="214" y2="158" stroke="#4ade80" strokeWidth="1" opacity="0.6" />
          <text x="152" y="175" textAnchor="middle" fill="#4ade80"
            fontSize="7.5" fontWeight="600" fontFamily="Inter,sans-serif">
            CHECKING…
          </text>
        </g>

        {/* Ground */}
        <line x1="20" y1="235" x2="280" y2="235" stroke="white" strokeWidth="2" opacity="0.2" />

        {/* ── Referee ── */}
        {/* Standing leg */}
        <line x1="112" y1="196" x2="104" y2="234" stroke="#000" strokeWidth="7" strokeLinecap="round" />
        <line x1="126" y1="196" x2="134" y2="234" stroke="#000" strokeWidth="7" strokeLinecap="round" />

        {/* Torso */}
        <rect x="100" y="148" width="42" height="52" rx="10" fill="#1a1a1a" stroke="white" strokeWidth="2" />
        {/* Referee stripes */}
        <rect x="100" y="160" width="42" height="8" rx="0" fill="#f59e0b" opacity="0.9" />
        <rect x="100" y="178" width="42" height="8" rx="0" fill="#f59e0b" opacity="0.9" />

        {/* Pointing arm */}
        <g className="fp-ref-point">
          <line x1="142" y1="158" x2="198" y2="150" stroke="#FBBF24" strokeWidth="7" strokeLinecap="round" />
          {/* Hand */}
          <circle cx="198" cy="150" r="6" fill="#FBBF24" />
          {/* Pointing finger */}
          <line x1="198" y1="144" x2="205" y2="132" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Other arm down */}
        <line x1="100" y1="162" x2="90" y2="185" stroke="#1a1a1a" strokeWidth="7" strokeLinecap="round" />

        {/* Head (with nod) */}
        <g className="fp-nod">
          <circle cx="118" cy="122" r="24" fill="#FBBF24" stroke="white" strokeWidth="2" />
          {/* Referee cap */}
          <ellipse cx="118" cy="100" rx="22" ry="6" fill="#1a1a1a" />
          <rect x="96" y="100" width="44" height="8" rx="2" fill="#1a1a1a" />
          {/* Eyes */}
          <circle cx="111" cy="121" r="3.5" fill="#1a1a1a" />
          <circle cx="125" cy="121" r="3.5" fill="#1a1a1a" />
          {/* Eyebrows — raised */}
          <line x1="107" y1="115" x2="115" y2="114" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
          <line x1="121" y1="114" x2="129" y2="115" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
          {/* Whistle */}
          <rect x="113" y="130" width="14" height="5" rx="2.5" fill="#d1d5db" />
          <line x1="120" y1="135" x2="120" y2="139" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>

      <div className="text-center text-white relative z-10">
        <p className="text-2xl font-black leading-tight mb-1.5">VAR check!</p>
        <p className="text-white/65 text-sm font-medium leading-snug">
          Enter the 6-digit code from your email<br />and choose a new password
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE 4 — Player knee-slide celebration (Password reset success)
   "You're back on the pitch!"
   Animation: knee slide, arms out, confetti, crowd wave
───────────────────────────────────────────────────────────────────────────── */
function CelebrationScene() {
  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-8 gap-8">
      <style>{`
        @keyframes fp-slide {
          0%   { transform: translateX(60px); }
          60%  { transform: translateX(-10px); }
          80%  { transform: translateX(-6px); }
          100% { transform: translateX(-10px); }
        }
        @keyframes fp-armL {
          0%,100% { transform: rotate(-20deg); }
          50%      { transform: rotate(-40deg); }
        }
        @keyframes fp-armR {
          0%,100% { transform: rotate(20deg); }
          50%      { transform: rotate(40deg); }
        }
        @keyframes fp-confettiA {
          0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
          100% { transform: translateY(80px) rotate(360deg); opacity:0; }
        }
        @keyframes fp-confettiB {
          0%   { transform: translateY(-10px) rotate(0deg) translateX(0); opacity:1; }
          100% { transform: translateY(90px) rotate(-300deg) translateX(20px); opacity:0; }
        }
        @keyframes fp-shout {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes fp-crowdWave {
          0%,100% { transform: scaleY(1); }
          50%      { transform: scaleY(1.3); }
        }
        @keyframes fp-starSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .fp-slider   { animation: fp-slide 2.2s ease-out infinite; }
        .fp-arm-l    { transform-origin: 126px 152px; animation: fp-armL 1.1s ease-in-out infinite; }
        .fp-arm-r    { transform-origin: 174px 152px; animation: fp-armR 1.1s ease-in-out infinite; }
        .fp-conf-a   { animation: fp-confettiA 1.8s ease-in infinite; }
        .fp-conf-b   { animation: fp-confettiB 2.1s 0.4s ease-in infinite; }
        .fp-conf-c   { animation: fp-confettiA 1.6s 0.8s ease-in infinite; }
        .fp-conf-d   { animation: fp-confettiB 2.3s 0.2s ease-in infinite; }
        .fp-conf-e   { animation: fp-confettiA 1.9s 1.1s ease-in infinite; }
        .fp-conf-f   { animation: fp-confettiB 1.7s 0.6s ease-in infinite; }
        .fp-shout    { animation: fp-shout 1.1s ease-in-out infinite; }
        .fp-cw1      { transform-origin: 50px 225px;  animation: fp-crowdWave 0.8s 0.0s ease-in-out infinite alternate; }
        .fp-cw2      { transform-origin: 80px 225px;  animation: fp-crowdWave 0.8s 0.1s ease-in-out infinite alternate; }
        .fp-cw3      { transform-origin: 110px 225px; animation: fp-crowdWave 0.8s 0.2s ease-in-out infinite alternate; }
        .fp-cw4      { transform-origin: 190px 225px; animation: fp-crowdWave 0.8s 0.3s ease-in-out infinite alternate; }
        .fp-cw5      { transform-origin: 220px 225px; animation: fp-crowdWave 0.8s 0.2s ease-in-out infinite alternate; }
        .fp-cw6      { transform-origin: 250px 225px; animation: fp-crowdWave 0.8s 0.1s ease-in-out infinite alternate; }
        .fp-starspin { transform-origin: 150px 60px; animation: fp-starSpin 4s linear infinite; }
      `}</style>

      <svg viewBox="0 0 300 265" className="w-full max-w-[300px]" aria-label="Player celebrating">

        {/* Spinning star burst (background) */}
        <g className="fp-starspin" opacity="0.2">
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i}
              x1="150" y1="60"
              x2={150 + 70 * Math.cos((i * Math.PI * 2) / 8)}
              y2={60 + 70 * Math.sin((i * Math.PI * 2) / 8)}
              stroke="#FDE047" strokeWidth="2" />
          ))}
        </g>

        {/* Confetti */}
        <rect className="fp-conf-a" x="75"  y="60" width="8"  height="8"  rx="1" fill="#FDE047" />
        <rect className="fp-conf-b" x="200" y="55" width="6"  height="6"  rx="1" fill="#f87171" />
        <rect className="fp-conf-c" x="110" y="50" width="7"  height="7"  rx="1" fill="#60a5fa" />
        <rect className="fp-conf-d" x="190" y="70" width="5"  height="5"  rx="1" fill="#FDE047" />
        <rect className="fp-conf-e" x="60"  y="75" width="9"  height="9"  rx="1" fill="#f87171" />
        <rect className="fp-conf-f" x="230" y="60" width="6"  height="6"  rx="1" fill="#4ade80" />

        {/* Stars */}
        <text x="50" y="88"  fontSize="16" fill="#FDE047" opacity="0.9">★</text>
        <text x="240" y="82" fontSize="12" fill="#FDE047" opacity="0.8">★</text>
        <text x="90"  y="68" fontSize="10" fill="#60a5fa" opacity="0.7">✦</text>
        <text x="218" y="96" fontSize="10" fill="#f87171" opacity="0.8">✦</text>

        {/* "YESSS!" speech bubble */}
        <g className="fp-shout">
          <path d="M 188 78 Q 230 68 235 88 Q 240 108 208 110 L 200 120 L 195 108 Q 172 110 168 92 Q 164 74 188 78 Z"
            fill="#FDE047" />
          <text x="200" y="98" textAnchor="middle" fill="#14532d"
            fontSize="11" fontWeight="900" fontFamily="Inter,sans-serif">YESSS!</text>
        </g>

        {/* Ground / pitch */}
        <line x1="20" y1="225" x2="280" y2="225" stroke="white" strokeWidth="2" opacity="0.3" />

        {/* Crowd silhouettes */}
        <rect className="fp-cw1" x="35"  y="210" width="16" height="16" rx="8" fill="white" opacity="0.2" />
        <rect className="fp-cw2" x="60"  y="214" width="16" height="12" rx="8" fill="white" opacity="0.2" />
        <rect className="fp-cw3" x="85"  y="210" width="16" height="16" rx="8" fill="white" opacity="0.15" />
        <rect className="fp-cw4" x="185" y="210" width="16" height="16" rx="8" fill="white" opacity="0.2" />
        <rect className="fp-cw5" x="210" y="214" width="16" height="12" rx="8" fill="white" opacity="0.2" />
        <rect className="fp-cw6" x="238" y="210" width="16" height="16" rx="8" fill="white" opacity="0.15" />

        {/* ── Knee-sliding player ── */}
        <g className="fp-slider">
          {/* Trail */}
          <line x1="200" y1="218" x2="240" y2="216" stroke="white" strokeWidth="1.5" opacity="0.2" strokeDasharray="4 4" />

          {/* Legs (on knees) */}
          <line x1="135" y1="196" x2="118" y2="220" stroke="white" strokeWidth="7" strokeLinecap="round" />
          <line x1="118" y1="220" x2="100" y2="220" stroke="white" strokeWidth="6" strokeLinecap="round" />
          <line x1="165" y1="196" x2="182" y2="220" stroke="white" strokeWidth="7" strokeLinecap="round" />
          <line x1="182" y1="220" x2="200" y2="218" stroke="white" strokeWidth="6" strokeLinecap="round" />

          {/* Body (leaning back in elation) */}
          <rect x="128" y="148" width="44" height="52" rx="12"
            fill="#16a34a" stroke="white" strokeWidth="2.5" />
          {/* Jersey number */}
          <text x="150" y="177" textAnchor="middle" fill="white"
            fontSize="12" fontWeight="900" fontFamily="Inter,sans-serif">10</text>

          {/* Left arm (raised wide) */}
          <g className="fp-arm-l">
            <line x1="128" y1="158" x2="96"  y2="138" stroke="#FBBF24" strokeWidth="7" strokeLinecap="round" />
            <circle cx="90" cy="135" r="7" fill="#FBBF24" />
          </g>

          {/* Right arm (raised wide) */}
          <g className="fp-arm-r">
            <line x1="172" y1="158" x2="204" y2="138" stroke="#FBBF24" strokeWidth="7" strokeLinecap="round" />
            <circle cx="210" cy="135" r="7" fill="#FBBF24" />
          </g>

          {/* Head (tilted back) */}
          <circle cx="150" cy="124" r="24" fill="#FBBF24" stroke="white" strokeWidth="2.5" />
          {/* Hair */}
          <rect x="130" y="104" width="40" height="10" rx="5" fill="#92400e" />
          {/* Eyes (closed in joy) */}
          <path d="M 141 122 Q 144 118 147 122" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 153 122 Q 156 118 159 122" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          {/* Big smile */}
          <path d="M 140 131 Q 150 141 160 131" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          {/* Cheeks */}
          <circle cx="138" cy="130" r="5" fill="#f87171" opacity="0.4" />
          <circle cx="162" cy="130" r="5" fill="#f87171" opacity="0.4" />
        </g>
      </svg>

      <div className="text-center text-white relative z-10">
        <p className="text-2xl font-black leading-tight mb-1.5">Back on the pitch!</p>
        <p className="text-white/65 text-sm font-medium leading-snug">
          Your password's been reset.<br />Get back in the game!
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step forms
───────────────────────────────────────────────────────────────────────────── */
function CTA({ loading, label, loadingLabel = 'Please wait…', onClick, type = 'submit' }) {
  return (
    <button
      type={type}
      disabled={loading}
      onClick={onClick}
      className="relative w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
      style={{
        background: loading ? '#15803d' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        boxShadow: loading ? 'none' : '0 4px 24px rgba(22,163,74,0.45)',
      }}
    >
      {loading && <Loader2 size={17} className="animate-spin" />}
      {loading ? loadingLabel : label}
    </button>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-medium animate-fade-in">
      <span className="mt-0.5">⚠</span><span>{msg}</span>
    </div>
  )
}

/* Step 0 — enter email */
function EmailStep({ onNext }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return }
    setError(''); setLoading(true)
    await new Promise(r => setTimeout(r, 1100))
    setLoading(false)
    onNext(email)
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--text)' }}>
          Forgot password?
        </h2>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          No worries — we'll send a reset code to your inbox.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <ErrorMsg msg={error} />
        <FloatInput
          id="email" label="Email address" type="email"
          value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
        <CTA loading={loading} label="Send Reset Code" loadingLabel="Sending…" />
      </form>
      <p className="text-sm text-center mt-6 font-medium" style={{ color: 'var(--text-muted)' }}>
        Remembered it?{' '}
        <Link to="/login" className="link font-bold">Back to sign in</Link>
      </p>
    </div>
  )
}

/* Step 1 — email sent */
function SentStep({ email, onNext }) {
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const resend = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setResendCooldown(30)
  }

  return (
    <div>
      <div className="mb-8">
        <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-950 flex items-center justify-center mb-5 text-2xl">
          📬
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--text)' }}>
          Check your inbox
        </h2>
        <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          We sent a 6-digit code to{' '}
          <span className="font-bold" style={{ color: 'var(--text)' }}>{email}</span>.
          It expires in 15 minutes.
        </p>
      </div>

      <div className="space-y-3">
        <CTA loading={false} label="I've got the code →" onClick={onNext} type="button" />

        <button
          type="button"
          disabled={loading || resendCooldown > 0}
          onClick={resend}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> Resending…</>
            : resendCooldown > 0
            ? <><RotateCcw size={15} /> Resend in {resendCooldown}s</>
            : <><RotateCcw size={15} /> Resend code</>
          }
        </button>
      </div>

      <p className="text-xs text-center mt-5 font-medium" style={{ color: 'var(--text-muted)' }}>
        Can't find it? Check your spam folder.
      </p>
    </div>
  )
}

/* Step 2 — enter code + new password */
function CodeStep({ onNext }) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [pass,   setPass]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [showP,  setShowP]  = useState(false)
  const [showC,  setShowC]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]  = useState('')

  const strength = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pass)).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a']

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]; next[i] = val; setDigits(next)
    if (val && i < 5) document.getElementById(`fp-d${i + 1}`)?.focus()
  }

  const handleDigitKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0)
      document.getElementById(`fp-d${i - 1}`)?.focus()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (digits.some(d => !d)) { setError('Please enter the full 6-digit code.'); return }
    if (pass.length < 8)      { setError('Password must be at least 8 characters.'); return }
    if (pass !== confirm)     { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    onNext()
  }

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--text)' }}>
          Enter your code
        </h2>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Enter the 6-digit code from your email, then set your new password.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <ErrorMsg msg={error} />

        {/* OTP input */}
        <div>
          <label className="block text-sm font-semibold mb-2.5" style={{ color: 'var(--text)' }}>
            Verification code
          </label>
          <div className="flex gap-2">
            {digits.map((d, i) => (
              <input
                key={i} id={`fp-d${i}`}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleDigitKey(i, e)}
                className="flex-1 h-12 text-center text-lg font-black rounded-xl outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: `2px solid ${d ? 'var(--primary)' : 'var(--border)'}`,
                  color: 'var(--text)',
                  boxShadow: d ? '0 0 0 3px rgba(22,163,74,0.12)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* New password */}
        <FloatInput
          id="new-pass" label="New password"
          type={showP ? 'text' : 'password'}
          value={pass} onChange={e => setPass(e.target.value)}
          autoComplete="new-password"
          suffix={
            <button type="button" onClick={() => setShowP(v => !v)}
              className="text-muted hover:text-green-600 transition-colors p-0.5" tabIndex={-1}>
              {showP ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        {pass && (
          <div className="-mt-2 px-0.5">
            <div className="flex gap-1 mb-1">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
                  style={{ background: i <= strength ? strengthColor[strength] : 'var(--border)' }} />
              ))}
            </div>
            <p className="text-xs font-medium" style={{ color: strength > 0 ? strengthColor[strength] : 'var(--text-muted)' }}>
              {strengthLabel[strength]}
            </p>
          </div>
        )}

        {/* Confirm */}
        <FloatInput
          id="confirm-pass" label="Confirm new password"
          type={showC ? 'text' : 'password'}
          value={confirm} onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          suffix={
            <button type="button" onClick={() => setShowC(v => !v)}
              className="text-muted hover:text-green-600 transition-colors p-0.5" tabIndex={-1}>
              {showC ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <CTA loading={loading} label="Reset Password" loadingLabel="Resetting…" />
      </form>
    </div>
  )
}

/* Step 3 — success */
function SuccessStep() {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (countdown <= 0) { navigate('/login'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, navigate])

  return (
    <div className="text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl"
        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 8px 24px rgba(22,163,74,0.4)' }}
      >
        🔓
      </div>
      <h2 className="text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--text)' }}>
        All sorted!
      </h2>
      <p className="text-sm font-medium mb-8" style={{ color: 'var(--text-muted)' }}>
        Your password has been reset successfully. You can now sign in with your new password.
      </p>

      <button
        onClick={() => navigate('/login')}
        className="relative w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-[0.98] mb-3"
        style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          boxShadow: '0 4px 24px rgba(22,163,74,0.45)',
        }}
      >
        Back to Sign In
      </button>

      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Redirecting automatically in{' '}
        <span className="font-bold" style={{ color: 'var(--primary)' }}>{countdown}s</span>
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Scene + form metadata per step
───────────────────────────────────────────────────────────────────────────── */
const STEPS = [
  { Scene: ShootScene },
  { Scene: GoalScene },
  { Scene: VARScene },
  { Scene: CelebrationScene },
]

/* ─────────────────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────────────────── */
export default function ForgotPassword() {
  const { isDark, toggleTheme } = useTheme()
  const [step,  setStep]  = useState(0)
  const [email, setEmail] = useState('')
  const [mounted, setMounted] = useState(false)
  const [prevStep, setPrevStep] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])

  const goTo = (n) => {
    setTransitioning(true)
    setTimeout(() => { setStep(n); setPrevStep(step); setTransitioning(false) }, 280)
  }

  const { Scene } = STEPS[step]

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel: animated scene ── */}
      <div
        className="hidden lg:flex flex-col w-[460px] shrink-0 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #15803d 0%, #166534 55%, #14532d 100%)' }}
      >
        <PitchLines />

        {/* Scene (crossfade on step change) */}
        <div
          className="flex flex-col flex-1 relative z-10 transition-all duration-300"
          style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateY(10px)' : 'translateY(0)' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 p-10 pb-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
              <span className="text-white text-lg font-black">B</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">Ball</span>
          </div>

          {/* Scene fills remaining space */}
          <Scene />

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 pb-10">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 7,
                  height: 7,
                  background: i === step ? 'white' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">

        {/* BG decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #16a34a, transparent)', transform: 'translate(40%,-40%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #16a34a, transparent)', transform: 'translate(-40%,40%)' }} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2.5 rounded-xl border transition-all hover:border-green-500 hover:text-green-600"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Back button (steps 1-2) */}
        {step > 0 && step < 3 && (
          <button
            onClick={() => goTo(step - 1)}
            className="absolute top-6 left-6 p-2.5 rounded-xl border transition-all hover:border-green-500 hover:text-green-600 flex items-center gap-1.5 text-sm font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}

        {/* Slide-in wrapper */}
        <div
          className="w-full max-w-sm transition-all duration-500 ease-out"
          style={{
            opacity: mounted && !transitioning ? 1 : 0,
            transform: mounted && !transitioning ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow">
              <span className="text-white font-black">B</span>
            </div>
            <span className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Ball</span>
          </div>

          {step === 0 && <EmailStep onNext={(e) => { setEmail(e); goTo(1) }} />}
          {step === 1 && <SentStep  email={email} onNext={() => goTo(2)} />}
          {step === 2 && <CodeStep  onNext={() => goTo(3)} />}
          {step === 3 && <SuccessStep />}
        </div>
      </div>
    </div>
  )
}

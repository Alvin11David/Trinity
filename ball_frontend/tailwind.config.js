/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Semantic tokens matching Trinity CSS vars
        appBg: {
          DEFAULT: '#f8fafc',
          dark: '#0d1117',
        },
        appSurface: {
          DEFAULT: '#ffffff',
          dark: '#161b22',
        },
        appCard: {
          DEFAULT: '#ffffff',
          dark: '#21262d',
        },
        appBorder: {
          DEFAULT: '#e2e8f0',
          dark: '#30363d',
        },
        appText: {
          DEFAULT: '#0f172a',
          dark: '#e6edf3',
        },
        appMuted: {
          DEFAULT: '#64748b',
          dark: '#8b949e',
        },
        // Trinity exact green palette
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          400: '#f87171',
          500: '#ef4444',
          700: '#b91c1c',
          950: '#450a0a',
        },
        blue: {
          100: '#dbeafe',
          500: '#3b82f6',
          950: '#172554',
        },
        yellow: {
          100: '#fef9c3',
          400: '#facc15',
          500: '#eab308',
          700: '#a16207',
          950: '#422006',
        },
        purple: {
          100: '#f3e8ff',
          500: '#a855f7',
          950: '#3b0764',
        },
        orange: {
          100: '#ffedd5',
          500: '#f97316',
          950: '#431407',
        },
        pink: {
          100: '#fce7f3',
          500: '#ec4899',
          950: '#500724',
        },
        indigo: {
          100: '#e0e7ff',
          500: '#6366f1',
          950: '#1e1b4b',
        },
        sky: {
          100: '#e0f2fe',
          500: '#0ea5e9',
          950: '#082f49',
        },
        redCard: '#E5484D',
        yellowCard: '#F5A623',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  Home, Trophy, Users, Globe, MessageCircle, Bell,
  User, LogOut, Sun, Moon, Menu, X, Zap, Settings,
} from 'lucide-react'
import { useState } from 'react'
import { CURRENT_USER, NOTIFICATIONS } from '../utils/mock'
import clsx from 'clsx'

const NAV = [
  { to: '/', icon: Home, label: 'Feed', exact: true },
  { to: '/matches', icon: Trophy, label: 'Matches' },
  { to: '/leagues', icon: Globe, label: 'Leagues' },
  { to: '/players', icon: Users, label: 'Players' },
  { to: '/teams', icon: Zap, label: 'Teams' },
  { to: '/communities', icon: Globe, label: 'Communities' },
  { to: '/chat', icon: MessageCircle, label: 'Messages' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
]

function NavItem({ to, icon: Icon, label, exact, badge }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) => clsx('nav-item group relative', isActive && 'active')}
    >
      <Icon size={20} strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const { logout } = useAuth()
  const { theme, toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const unreadNotifs = NOTIFICATIONS.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Sidebar overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-30 flex flex-col w-64 px-3 py-6 border-r transition-transform duration-200',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow-md">
            <span className="text-white text-lg font-black">B</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            Ball
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV.map(item => (
            <NavItem
              key={item.to}
              {...item}
              badge={item.to === '/notifications' ? unreadNotifs : 0}
            />
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="space-y-2 mt-4">
          <NavLink
            to="/settings"
            className={({ isActive }) => clsx('nav-item', isActive && 'active')}
          >
            <Settings size={20} strokeWidth={1.8} />
            <span>Settings</span>
          </NavLink>

          <button
            onClick={toggleTheme}
            className="nav-item w-full text-left"
          >
            {isDark ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button
            className="nav-item w-full text-left"
            onClick={() => navigate('/profile')}
          >
            <img
              src={CURRENT_USER.avatar}
              alt={CURRENT_USER.username}
              className="w-5 h-5 rounded-full object-cover"
            />
            <span>@{CURRENT_USER.username}</span>
          </button>

          <button
            onClick={logout}
            className="nav-item w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut size={20} strokeWidth={1.8} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white text-sm font-black">B</span>
            </div>
            <span className="font-bold" style={{ color: 'var(--text)' }}>Ball</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

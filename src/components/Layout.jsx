import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../App'

const NAV = [
  { path: '/',          label: 'Dashboard',      icon: '▤' },
  { path: '/new',       label: 'New Inquiry',     icon: '+' },
  { path: '/analytics', label: 'Analytics',       icon: '◈' },
  { path: '/people',    label: 'Manage People',   icon: '◎' },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const sidebar = (
    <>
      {/* Gold accent line */}
      <div className="h-0.5 flex-shrink-0" style={{ background: 'linear-gradient(90deg, #C9A44A, transparent)' }} />

      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#1E1E1E' }}>
        <div className="text-[9px] font-semibold tracking-[0.2em]" style={{ color: '#C9A44A' }}>SCHUECO BLACK</div>
        <div className="text-white text-base font-medium mt-1.5">LRS</div>
        <div className="text-[10px] mt-0.5 tracking-wider" style={{ color: '#5A5450' }}>Lead Registration System</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {NAV.map(item => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-2.5 w-full px-5 py-2.5 text-[13px] text-left transition-all duration-100"
              style={{
                color: active ? '#C9A44A' : '#5A5450',
                background: active ? 'rgba(201,164,74,0.09)' : 'transparent',
                borderLeft: `2px solid ${active ? '#C9A44A' : 'transparent'}`,
                fontWeight: active ? 500 : 400,
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User info + sign out */}
      <div className="px-5 py-4 border-t" style={{ borderColor: '#1E1E1E' }}>
        <div className="text-[9px] tracking-widest mb-1.5" style={{ color: '#3A3530' }}>SIGNED IN AS</div>
        <div className="text-white text-xs truncate mb-3">{session?.user?.email}</div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs transition-colors hover:text-white"
          style={{ color: '#5A5450' }}
        >
          Sign out →
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden font-sans">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden md:flex w-52 flex-shrink-0 flex-col" style={{ background: '#0F0F0F' }}>
        {sidebar}
      </div>

      {/* ── Mobile top bar (visible only on mobile) ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex md:hidden items-center justify-between px-4 h-14" style={{ background: '#0F0F0F' }}>
        <div className="flex items-center gap-2.5">
          <div className="text-[9px] font-semibold tracking-[0.2em]" style={{ color: '#C9A44A' }}>SCHUECO BLACK</div>
          <div className="text-white text-sm font-medium">LRS</div>
        </div>
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="text-white w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: drawerOpen ? 'rgba(201,164,74,0.2)' : 'transparent' }}
          aria-label="Toggle menu"
        >
          {drawerOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 6H17M3 10H17M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          )}
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute top-14 right-0 bottom-0 w-64 flex flex-col overflow-y-auto"
            style={{ background: '#0F0F0F' }}
            onClick={e => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0" style={{ background: '#F5F3EF' }}>
        {children}
      </main>
    </div>
  )
}

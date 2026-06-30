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

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* ── Sidebar ── */}
      <div className="w-52 flex-shrink-0 flex flex-col" style={{ background: '#0F0F0F' }}>
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
      </div>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto" style={{ background: '#F5F3EF' }}>
        {children}
      </main>
    </div>
  )
}

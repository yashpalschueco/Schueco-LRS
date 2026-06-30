import { useState } from 'react'
import { supabase } from '../supabase'

const ALLOWED_DOMAINS = ['@schueco.in', '@schueco.com']

function isAllowedEmail(email) {
  return ALLOWED_DOMAINS.some(d => email.toLowerCase().endsWith(d))
}

// ── Must be outside Login so React doesn't remount on every keystroke ──
function PasswordInput({ id, value, onChange, placeholder, show, onToggle }) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required
        placeholder={placeholder}
        className="w-full px-4 py-2.5 pr-16 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 transition-colors"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium transition-colors"
        style={{ color: '#C9A44A' }}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export default function Login() {
  const [mode, setMode]                       = useState('signin')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState('')

  function switchMode(newMode) {
    setMode(newMode)
    setError('')
    setSuccess('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirm(false)
  }

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Invalid email or password. Please try again.')
    setLoading(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    if (!isAllowedEmail(email)) {
      setError('Only @schueco.in or @schueco.com email addresses can create an account.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.')
      switchMode('signin')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Brand panel */}
      <div
        className="hidden lg:flex w-5/12 flex-col justify-between p-12"
        style={{ background: '#0F0F0F' }}
      >
        <div>
          <div className="w-10 h-0.5 mb-8" style={{ background: '#C9A44A' }} />
          <div className="text-[10px] font-semibold tracking-[0.22em] mb-4" style={{ color: '#C9A44A' }}>
            SCHUECO BLACK
          </div>
          <div className="text-white text-4xl font-light leading-snug">
            Lead Registration<br />System
          </div>
        </div>
        <div>
          <div className="text-sm leading-7" style={{ color: '#3A3530' }}>
            One inquiry.<br />
            One owner.<br />
            No duplicates. No confusion.
          </div>
          <div className="mt-6 text-[10px] tracking-widest" style={{ color: '#2A2520' }}>
            SCHUECO INDIA · PRIVATE HOME
          </div>
        </div>
      </div>

      {/* Right — Form panel */}
      <div className="flex-1 flex items-center justify-center px-8" style={{ background: '#F5F3EF' }}>
        <div className="w-full max-w-sm">

          <div className="mb-7">
            <div className="lg:hidden text-[9px] font-semibold tracking-[0.2em] mb-3" style={{ color: '#C9A44A' }}>
              SCHUECO BLACK · LRS
            </div>
            <h1 className="text-xl font-medium text-gray-900">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {mode === 'signin'
                ? 'Access the Schueco Black LRS'
                : 'Only @schueco.in or @schueco.com emails accepted'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex mb-6 bg-white border border-gray-200 rounded-lg p-1">
            {['signin', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="flex-1 py-1.5 text-sm rounded-md transition-all"
                style={{
                  background: mode === m ? '#0F0F0F' : 'transparent',
                  color:      mode === m ? '#fff'    : '#9CA3AF',
                  fontWeight: mode === m ? 500       : 400,
                }}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Sign In */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@schueco.in"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">PASSWORD</label>
                <PasswordInput
                  id="signin-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  show={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-50 hover:opacity-85 mt-1"
                style={{ background: '#0F0F0F' }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          {/* Sign Up */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">
                  WORK EMAIL <span style={{ color: '#C9A44A' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@schueco.in"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 transition-colors"
                />
                <p className="text-[11px] text-gray-400 mt-1">Must be a @schueco.in or @schueco.com address</p>
              </div>
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">
                  PASSWORD <span style={{ color: '#C9A44A' }}>*</span>
                </label>
                <PasswordInput
                  id="signup-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  show={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">
                  CONFIRM PASSWORD <span style={{ color: '#C9A44A' }}>*</span>
                </label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  show={showConfirm}
                  onToggle={() => setShowConfirm(p => !p)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-50 hover:opacity-85 mt-1"
                style={{ background: '#0F0F0F' }}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}

          <p className="mt-8 text-xs text-center" style={{ color: '#AAA49E' }}>
            {mode === 'signin'
              ? 'No account? Use the Sign up tab above.'
              : 'Already have an account? Use the Sign in tab above.'}
          </p>
        </div>
      </div>
    </div>
  )
}

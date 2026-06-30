import { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewInquiry from './pages/NewInquiry'
import EditInquiry from './pages/EditInquiry'
import PeopleManager from './pages/PeopleManager'
import Analytics    from './pages/Analytics'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function Protected({ children }) {
  const { session } = useAuth()
  return session ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
        <div className="text-xs tracking-widest" style={{ color: '#C9A44A' }}>LOADING...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ session }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login"      element={!session ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/"           element={<Protected><Dashboard /></Protected>} />
          <Route path="/new"        element={<Protected><NewInquiry /></Protected>} />
          <Route path="/edit/:id"   element={<Protected><EditInquiry /></Protected>} />
          <Route path="/people"     element={<Protected><PeopleManager /></Protected>} />
          <Route path="/analytics"  element={<Protected><Analytics /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

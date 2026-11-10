import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import Subjects from './pages/Subjects.jsx'
import SubjectDetail from './pages/SubjectDetail.jsx'
import Auth from './pages/Auth.jsx'
import { getUser, isLoggedIn, logout } from './api'

const links = [
  { to: '/', label: 'Dashboard', icon: '⌂', end: true },
  { to: '/upload', label: 'Upload Syllabus', icon: '↑' },
  { to: '/subjects', label: 'My Subjects', icon: '▤' },
]

// Poora layout (sidebar + header) sirf login ke baad dikhta hai
function AppLayout() {
  const location = useLocation()
  const user = getUser()
  const firstName = user?.name?.trim().split(' ')[0] || 'Student'
  const initial = firstName.charAt(0).toUpperCase()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#f8f7ff] text-slate-800">

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-violet-100 bg-white px-6 py-7 shadow-[4px_0_30px_rgba(99,102,241,0.04)] md:flex">

        {/* Brand */}
        <NavLink to="/" className="mb-12 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl text-white shadow-lg shadow-violet-200">
            ✦
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Syllabify<span className="text-violet-600"> AI</span>
            </h1>
            <p className="text-[11px] font-medium tracking-wider text-slate-400">
              SMART LEARNING SPACE
            </p>
          </div>
        </NavLink>

        {/* Navigation */}
        <div className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </div>

        <nav className="space-y-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `group flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200'
                    : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700'
                }`
              }
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xl">
                {link.icon}
              </span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user + logout */}
        <div className="mt-auto space-y-3">
          <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-5 text-white shadow-xl shadow-violet-200">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">
              ✨
            </div>
            <h3 className="mb-2 font-bold">Learn smarter!</h3>
            <p className="text-xs leading-5 text-violet-100">
              Turn your syllabus into a personalized learning journey.
            </p>
            <div className="mt-4 h-1 rounded-full bg-white/20">
              <div className="h-1 w-2/3 rounded-full bg-white" />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {user?.name || 'Student'}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-h-screen md:pl-[260px]">

        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-violet-100/80 bg-white/85 px-5 backdrop-blur-xl sm:px-8 lg:px-10">

          <div>
            <p className="text-xs font-medium text-slate-400">
              Your learning space
            </p>
            <h2 className="text-lg font-bold text-slate-800">
              Welcome back, {firstName} <span className="text-violet-600">✦</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 sm:block">
              ✨ AI Powered Learning
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-md shadow-violet-200">
              {initial}
            </div>
            {/* Chhoti screen pe logout yahin dikhega */}
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 md:hidden"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Mobile navigation */}
        <nav className="sticky top-[76px] z-20 flex justify-around border-b border-violet-100 bg-white px-2 py-3 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-500'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Page content */}
        <main className="mx-auto w-full max-w-[1500px] p-5 sm:p-8 lg:p-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<SubjectDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-violet-100 px-8 py-5 text-center text-xs text-slate-400">
          Made for smarter learning with Syllabify AI ✦
        </footer>
      </div>
    </div>
  )
}

// Har baar page khulne par login check karta hai
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

export default App
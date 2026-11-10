import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { login, signup, isLoggedIn, getErrorMessage } from '../api'

export default function Auth({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pehle se login ho to seedha dashboard pe bhejo
  if (isLoggedIn()) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (isSignup && !name.trim()) return setError('Apna naam daalo.')
    if (!email.trim()) return setError('Email daalo.')
    if (!password) return setError('Password daalo.')

    setLoading(true)
    try {
      if (isSignup) {
        await signup(name.trim(), email.trim(), password)
      } else {
        await login(email.trim(), password)
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50">
      {/* Left: branding (sirf badi screen pe) */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500 p-12 text-white lg:flex">
        <div className="text-2xl font-bold">Syllabify AI</div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Syllabus upload karo.
            <br />
            Videos apne aap mil jayenge.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Har topic ke liye YouTube videos, lecture ke andar sahi jagah ka
            timestamp (jab transcript mile), aur apni padhai ka poora progress,
            ek hi jagah.
          </p>
        </div>
        <div className="text-sm text-white/70">
          Made for smarter learning with Syllabify AI
        </div>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-indigo-100">
          <div className="mb-1 text-lg font-bold text-indigo-600 lg:hidden">
            Syllabify AI
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isSignup ? 'Account banao' : 'Welcome back'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isSignup
              ? 'Apni padhai ka progress save karne ke liye signup karo.'
              : 'Login karke apni padhai wahin se shuru karo.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Naam
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tumhara naam"
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tum@example.com"
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'Kam se kam 6 akshar' : 'Password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className={inputClass + ' pr-16'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Ruko...'
                : isSignup
                ? 'Account banao'
                : 'Login karo'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isSignup ? 'Pehle se account hai?' : 'Naya ho?'}{' '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              className="font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {isSignup ? 'Login karo' : 'Signup karo'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
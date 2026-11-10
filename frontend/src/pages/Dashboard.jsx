import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDashboard, getSubjects } from '../api.js'

/* ---------- helpers ---------- */

const NAME_KEY = 'syllabify_user_name'

function toDate(value) {
  if (!value) return null
  let s = String(value)
  // Backend UTC time bhejta hai bina 'Z' ke, isliye UTC maan lo
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function timeAgo(date) {
  if (!date) return ''
  const diff = Math.max(0, Date.now() - date.getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night study'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

function countTopics(subject) {
  let total = 0
  let completed = 0
  let inProgress = 0
  let firstPending = null
  ;(subject.units || []).forEach((unit) => {
    ;(unit.topics || []).forEach((t) => {
      total += 1
      if (t.status === 'completed') completed += 1
      else if (t.status === 'in_progress') inProgress += 1
      else if (!firstPending) firstPending = t
    })
  })
  return { total, completed, inProgress, firstPending }
}

const STATUS_STYLE = {
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  in_progress: { label: 'In progress', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

const CHART_COLORS = {
  completed: '#4f46e5',
  in_progress: '#a78bfa',
  pending: '#e0e7ff',
}

/* ---------- small UI pieces ---------- */

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    book: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Zm2 14h12M8 7h6',
    layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5',
    check: 'M20 6 9 17l-5-5',
    clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    pencil: 'm4 20 4-1 11-11-3-3L5 16l-1 4Z',
    spark: 'M12 3v4m0 10v4M3 12h4m10 0h4m-3.5-6.5-2.8 2.8m-5.4 5.4-2.8 2.8m0-11 2.8 2.8m5.4 5.4 2.8 2.8',
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}

function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-2xl border border-indigo-100/70 bg-white p-5 shadow-sm shadow-indigo-100/50 ${className}`}
    >
      {children}
    </div>
  )
}

function SectionTitle({ title, hint, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {right}
    </div>
  )
}

function StatCard({ label, value, icon, gradient, iconBg }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-indigo-100/70 bg-gradient-to-br ${gradient} p-4 shadow-sm shadow-indigo-100/50`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  )
}

function ProgressRing({ percent }) {
  const r = 42
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{percent}%</span>
        <span className="text-[10px] uppercase tracking-wider text-white/70">Overall</span>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-5">
      <div className="h-44 rounded-3xl bg-indigo-100/70" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-indigo-100/60" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-indigo-100/60 lg:col-span-2" />
        <div className="h-64 rounded-2xl bg-indigo-100/60" />
      </div>
    </div>
  )
}

/* ---------- main page ---------- */

function Dashboard() {
  const [data, setData] = useState(null)
  const [subjectList, setSubjectList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || ''
    } catch {
      return ''
    }
  })
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dash, list] = await Promise.all([
        getDashboard(),
        getSubjects().catch(() => []),
      ])
      setData(dash)
      setSubjectList(Array.isArray(list) ? list : [])
    } catch (err) {
      setError('Dashboard load nahi hua. Backend (port 8000) chalu hai?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function saveName() {
    const clean = nameDraft.trim().slice(0, 30)
    setName(clean)
    try {
      if (clean) localStorage.setItem(NAME_KEY, clean)
      else localStorage.removeItem(NAME_KEY)
    } catch {
      /* storage na chale to bhi theek */
    }
    setEditingName(false)
  }

  const recent = useMemo(() => data?.recent_topics || [], [data])

  // Subject cards: real counts subjects list se, warna dashboard ke fields se
  const subjectCards = useMemo(() => {
    const base = data?.subjects?.length ? data.subjects : subjectList
    return base.map((s) => {
      const full = subjectList.find((x) => x.id === s.id) || s
      const c = countTopics(full)
      const percent =
        c.total > 0
          ? Math.round((c.completed / c.total) * 100)
          : s.percent ?? s.overall_percent ?? s.progress_percent ?? 0
      return {
        id: s.id,
        name: s.name || `Subject ${s.id}`,
        total: c.total,
        completed: c.completed,
        inProgress: c.inProgress,
        percent,
        firstPending: c.firstPending,
      }
    })
  }, [data, subjectList])

  // Pending: har subject ka agla pending topic, jis subject mein progress zyada wo pehle
  const upNext = useMemo(
    () =>
      [...subjectCards]
        .filter((s) => s.firstPending)
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 6),
    [subjectCards]
  )

  // Activity: recent topics ki asli dates se pichhle 7 din
  const { activity, hasDates } = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      days.push({
        key: d.toDateString(),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        topics: 0,
      })
    }
    let found = false
    recent.forEach((t) => {
      const d = toDate(t.last_studied || t.updated_at || t.studied_at)
      if (!d) return
      found = true
      const row = days.find((x) => x.key === d.toDateString())
      if (row) row.topics += 1
    })
    return { activity: days, hasDates: found }
  }, [recent])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-rose-600">{error}</p>
        <button
          onClick={load}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Dobara try karo
        </button>
      </div>
    )
  }

  if (!data) return null

  const totalTopics = data.total_topics ?? 0
  const completed = data.completed ?? 0
  const inProgress = data.in_progress ?? 0
  const pending = data.pending ?? 0
  const overall = data.overall_percent ?? 0

  const pieData = [
    { key: 'completed', name: 'Completed', value: completed },
    { key: 'in_progress', name: 'In progress', value: inProgress },
    { key: 'pending', name: 'Pending', value: pending },
  ]

  const subjectBars = subjectCards.map((s) => ({
    name: s.name.replace(/\(.*?\)/g, '').trim() || s.name,
    percent: s.percent,
  }))

  const displayName = name || 'Student'

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-indigo-200/70 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-violet-400/20" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-indigo-100">{greeting()}</p>

            {editingName ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  placeholder="Apna naam likho"
                  className="w-44 rounded-lg border border-white/30 bg-white/15 px-3 py-1.5 text-lg font-semibold text-white placeholder-white/50 outline-none focus:border-white"
                />
                <button
                  onClick={saveName}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700"
                >
                  Save
                </button>
              </div>
            ) : (
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="truncate">{displayName}</span>
                <span aria-hidden>👋</span>
                <button
                  onClick={() => {
                    setNameDraft(name)
                    setEditingName(true)
                  }}
                  title="Naam badlo"
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/15 hover:text-white"
                >
                  <Icon name="pencil" className="h-4 w-4" />
                </button>
              </h2>
            )}

            <p className="mt-2 max-w-md text-sm text-indigo-100">
              {totalTopics === 0
                ? 'Abhi koi syllabus upload nahi hua. Shuru karne ke liye apna PDF upload karo.'
                : `Tumne ${totalTopics} mein se ${completed} topics complete kiye hain. ${
                    inProgress > 0 ? `${inProgress} abhi chal rahe hain.` : 'Agla topic uthao aur aage badho.'
                  }`}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={totalTopics === 0 ? '/upload' : '/subjects'}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50"
              >
                {totalTopics === 0 ? 'Syllabus upload karo' : 'Padhai jaari rakho'}
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <ProgressRing percent={overall} />
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total subjects"
          value={data.total_subjects ?? 0}
          icon="book"
          gradient="from-white to-indigo-50"
          iconBg="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          label="Total topics"
          value={totalTopics}
          icon="layers"
          gradient="from-white to-violet-50"
          iconBg="bg-violet-100 text-violet-600"
        />
        <StatCard
          label="Completed"
          value={completed}
          icon="check"
          gradient="from-white to-emerald-50"
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          label="In progress"
          value={inProgress}
          icon="clock"
          gradient="from-white to-fuchsia-50"
          iconBg="bg-fuchsia-100 text-fuchsia-600"
        />
      </section>

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title={hasDates ? 'Learning activity' : 'Progress by subject'}
            hint={
              hasDates
                ? 'Pichhle 7 din mein update kiye gaye topics'
                : 'Har subject mein kitna % complete hua'
            }
          />
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {hasDates ? (
                <BarChart data={activity} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e7ff" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: '#eef2ff' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e0e7ff', fontSize: 12 }}
                  />
                  <Bar dataKey="topics" name="Topics" fill="url(#barFill)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              ) : (
                <BarChart data={subjectBars} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFill2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e7ff" />
                  <XAxis dataKey="name" tick={false} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: '#eef2ff' }}
                    formatter={(v) => [`${v}%`, 'Progress']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e0e7ff', fontSize: 12 }}
                  />
                  <Bar dataKey="percent" fill="url(#barFill2)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Topic status" hint="Saare topics ka breakup" />
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={totalTopics > 0 ? 2 : 0}
                  stroke="none"
                >
                  {pieData.map((p) => (
                    <Cell key={p.key} fill={CHART_COLORS[p.key]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e0e7ff', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{overall}%</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Done</span>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {pieData.map((p) => (
              <li key={p.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[p.key] }} />
                  {p.name}
                </span>
                <span className="font-semibold text-slate-900">{p.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Subject progress */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Subject progress</h3>
          <Link to="/subjects" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Sab dekho
          </Link>
        </div>
        {subjectCards.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Abhi koi subject nahi hai.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjectCards.map((s) => (
              <Link
                key={s.id}
                to={`/subjects/${s.id}`}
                className="group rounded-2xl border border-indigo-100/70 bg-white p-4 shadow-sm shadow-indigo-100/50 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{s.name}</p>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                    {s.percent}%
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-indigo-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {s.total > 0
                    ? `${s.completed} / ${s.total} topics complete`
                    : 'Topics ka count available nahi'}
                  {s.inProgress > 0 ? ` · ${s.inProgress} in progress` : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent + Pending */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Recently studied" hint="Tumhare aakhri updated topics" />
          {recent.length === 0 ? (
            <div className="rounded-xl bg-indigo-50/60 p-4 text-center text-sm text-slate-500">
              Abhi koi topic update nahi hua. Kisi topic ko In progress ya Completed karo.
            </div>
          ) : (
            <ul className="divide-y divide-indigo-50">
              {recent.slice(0, 6).map((t, i) => {
                const st = STATUS_STYLE[t.status] || STATUS_STYLE.pending
                const when = timeAgo(toDate(t.last_studied || t.updated_at || t.studied_at))
                const subj = t.subject || t.subject_name
                return (
                  <li key={t.id ?? i} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{t.title || t.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[subj, when].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${st.cls}`}>
                      {st.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Up next"
            hint="Har subject ka agla pending topic"
            right={
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {pending} pending
              </span>
            }
          />
          {upNext.length === 0 ? (
            <div className="rounded-xl bg-indigo-50/60 p-4 text-center text-sm text-slate-500">
              Koi pending topic nahi bacha. Zabardast! 🎉
            </div>
          ) : (
            <ul className="divide-y divide-indigo-50">
              {upNext.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/subjects/${s.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {s.firstPending.title || s.firstPending.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{s.name}</p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon name="arrow" className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}

export default Dashboard
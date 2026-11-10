import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSubjects } from '../api.js'

function countTopics(subject) {
  let total = 0
  let completed = 0
  ;(subject.units || []).forEach((unit) => {
    ;(unit.topics || []).forEach((t) => {
      total += 1
      if (t.status === 'completed') completed += 1
    })
  })
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const list = await getSubjects()
        setSubjects(Array.isArray(list) ? list : [])
      } catch (err) {
        setError('Subjects load nahi hue. Backend (port 8000) chalu hai?')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <p className="text-gray-600">Loading...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (subjects.length === 0) {
    return (
      <p className="text-gray-600">
        Abhi koi subject nahi hai. Pehle Upload page se syllabus upload karo.
      </p>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Subjects</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => {
          const { total, completed, percent } = countTopics(s)
          return (
            <Link
              key={s.id}
              to={`/subjects/${s.id}`}
              className="rounded border bg-white p-4 shadow-sm hover:border-blue-600 hover:shadow"
            >
              <p className="font-semibold text-gray-800">{s.name}</p>

              <div className="mt-3 h-2 w-full rounded bg-gray-200">
                <div
                  className="h-2 rounded bg-green-600"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-600">
                {completed} / {total} topics complete ({percent}%)
              </p>

              <p className="mt-3 text-sm text-blue-600">Topics dekho</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default Subjects
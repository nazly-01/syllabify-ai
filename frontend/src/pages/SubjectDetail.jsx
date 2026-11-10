import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSubject, updateTopicStatus } from '../api.js'
import TopicVideos from '../components/TopicVideos.jsx'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

function SubjectDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Kin topics ke videos khule hain (topic id ki list)
  const [openTopics, setOpenTopics] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const result = await getSubject(id)
        setData(result)
      } catch (err) {
        setError('Subject load nahi hua. Backend (port 8000) chalu hai?')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleStatusChange(topicId, newStatus) {
    try {
      await updateTopicStatus(topicId, newStatus)
      setData((prev) => {
        const copy = JSON.parse(JSON.stringify(prev))
        const allUnits = copy.units || []
        allUnits.forEach((unit) => {
          ;(unit.topics || []).forEach((t) => {
            if (t.id === topicId) t.status = newStatus
          })
        })
        return copy
      })
    } catch (err) {
      alert('Status save nahi hua. Backend chalu hai?')
    }
  }

  // Videos button: topic id list mein add ya remove
  function toggleVideos(topicId) {
    setOpenTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((x) => x !== topicId)
        : [...prev, topicId]
    )
  }

  if (loading) return <p className="text-gray-600">Loading...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!data) return null

  const units = data.units || []

  return (
    <div className="max-w-4xl">
      <Link to="/subjects" className="text-sm text-blue-600 hover:underline">
        &larr; Subjects pe wapas
      </Link>
      <h2 className="mb-4 mt-2 text-2xl font-bold text-gray-800">
        {data.name || `Subject ${id}`}
      </h2>

      {units.length === 0 && (
        <p className="text-gray-600">Is subject mein units nahi mile.</p>
      )}

      <div className="space-y-4">
        {units.map((unit, i) => (
          <div key={unit.id ?? i} className="rounded border bg-white p-4">
            <h3 className="mb-3 font-semibold text-gray-800">
              {unit.name || unit.title || `Unit ${i + 1}`}
            </h3>
            <ul className="space-y-2">
              {(unit.topics || []).map((t) => (
                <li key={t.id} className="border-b pb-2 text-sm last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-700">{t.name || t.title}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleVideos(t.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        {openTopics.includes(t.id) ? 'Videos band' : 'Videos'}
                      </button>
                      <select
                        value={t.status || 'pending'}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {openTopics.includes(t.id) && <TopicVideos topicId={t.id} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <details className="mt-6 rounded border bg-white p-4">
        <summary className="cursor-pointer text-sm text-gray-600">
          Backend ka raw jawab (debug)
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default SubjectDetail
import { useState } from 'react'
import { uploadSyllabus, getSubjects } from '../api.js'

function Upload() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rawResponse, setRawResponse] = useState(null)
  const [subjects, setSubjects] = useState([])

  async function handleUpload() {
    if (!file) {
      setError('Pehle ek PDF file choose karo.')
      return
    }
    setLoading(true)
    setError('')
    setRawResponse(null)
    try {
      const result = await uploadSyllabus(file)
      setRawResponse(result)
      const list = await getSubjects()
      setSubjects(Array.isArray(list) ? list : [])
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Upload fail hua. Backend (port 8000) chalu hai?'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Syllabus Upload</h2>

      <div className="rounded border bg-white p-4">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0] || null)}
          className="block w-full text-sm"
        />
        <button
          onClick={handleUpload}
          disabled={loading}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Upload ho raha hai...' : 'Upload karo'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {rawResponse && (
        <div className="mt-6 rounded border bg-white p-4">
          <h3 className="mb-2 font-semibold text-gray-800">Backend ka jawab</h3>
          <pre className="max-h-48 overflow-auto rounded bg-gray-100 p-2 text-xs">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </div>
      )}

      {subjects.length > 0 && (
        <div className="mt-6 rounded border bg-white p-4">
          <h3 className="mb-2 font-semibold text-gray-800">
            Saved subjects ({subjects.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {subjects.map((s) => (
              <li key={s.id}>{s.name || s.title || `Subject ${s.id}`}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default Upload
import { useEffect, useState } from 'react'
import { getTopicResources } from '../api.js'

// Seconds ko mm:ss mein badalta hai (sirf tab jab asli timestamp ho)
function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function TopicVideos({ topicId }) {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const result = await getTopicResources(topicId, false)
        setRaw(result)
      } catch (err) {
        setError('Videos load nahi hue. Backend ya YouTube key check karo.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [topicId])

  if (loading) return <p className="text-xs text-gray-500">Videos dhoondh raha hoon...</p>
  if (error) return <p className="text-xs text-red-600">{error}</p>

  // Backend ka jawab list ho ya {resources: [...]} ya {videos: [...]}, teeno chalega
  const videos = Array.isArray(raw)
    ? raw
    : raw?.resources || raw?.videos || []

  if (videos.length === 0) {
    return <p className="text-xs text-gray-500">Is topic ke liye koi video nahi mila.</p>
  }

  return (
    <div className="mt-3 space-y-3">
      {videos.map((v, i) => {
        const videoId = v.video_id || v.youtube_id || v.id
        const url = v.url || `https://www.youtube.com/watch?v=${videoId}`
        const thumb =
          v.thumbnail ||
          v.thumbnail_url ||
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
        const hasTime = typeof v.start_seconds === 'number'
        const link = hasTime ? `${url}${url.includes('?') ? '&' : '?'}t=${v.start_seconds}s` : url

        return (
          <a
            key={videoId || i}
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex gap-3 rounded border bg-gray-50 p-2 hover:border-blue-600"
          >
            <img src={thumb} alt={v.title} className="h-16 w-28 rounded object-cover" />
            <div className="text-xs">
              <p className="font-medium text-gray-800">{v.title}</p>
              {(v.channel || v.channel_title) && (
                <p className="mt-1 text-gray-500">{v.channel || v.channel_title}</p>
              )}
              {hasTime && (
                <p className="mt-1 text-blue-600">Yahan se: {formatTime(v.start_seconds)}</p>
              )}
            </div>
          </a>
        )
      })}

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">Raw jawab (debug)</summary>
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-100 p-2">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default TopicVideos
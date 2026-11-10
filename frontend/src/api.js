import axios from 'axios'

const TOKEN_KEY = 'syllabify_token'
const USER_KEY = 'syllabify_user'

const api = axios.create({
  baseURL: '/api',
})

// ---------- Token / user ko browser mein save karna ----------

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function isLoggedIn() {
  return !!getToken()
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  window.location.href = '/login'
}

// ---------- Har request ke saath token bhejo ----------

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Token galat ya expire ho jaye to login page pe bhej do
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/signup')
    const onAuthPage =
      window.location.pathname === '/login' ||
      window.location.pathname === '/signup'

    if (err.response?.status === 401 && !isAuthCall && !onAuthPage) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Backend ka error message nikalne ke liye (pages mein kaam aayega)
export function getErrorMessage(err, fallback = 'Kuch gadbad ho gayi.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  if (err?.code === 'ERR_NETWORK') return 'Backend se connect nahi ho paaya.'
  return fallback
}

// ---------- Auth ----------

export async function signup(name, email, password) {
  const res = await api.post('/auth/signup', { name, email, password })
  saveSession(res.data)
  return res.data
}

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password })
  saveSession(res.data)
  return res.data
}

export async function getMe() {
  const res = await api.get('/auth/me')
  return res.data
}

// ---------- Purane functions (naam wahi hain) ----------

export async function uploadSyllabus(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/upload', formData)
  return res.data
}

export async function getSubjects() {
  const res = await api.get('/subjects')
  return res.data
}

export async function getSubject(id) {
  const res = await api.get(`/subjects/${id}`)
  return res.data
}

export async function getTopicResources(topicId, refresh = false) {
  const res = await api.get(`/topics/${topicId}/resources`, {
    params: { refresh },
  })
  return res.data
}

export async function updateTopicStatus(topicId, status) {
  const res = await api.patch(`/topics/${topicId}/status`, { status })
  return res.data
}

export async function getDashboard() {
  const res = await api.get('/dashboard')
  return res.data
}
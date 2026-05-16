import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('im_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// Documents
export const generateDocument = (data) => api.post('/documents/generate', data)
export const refineDocument = (data) => api.post('/documents/refine', data)
export const ingestDocument = (data) => api.post('/documents/ingest', data)
export const getKBStats = () => api.get('/documents/knowledge-base/stats')
export const createTicketsFromBRD = (data) => api.post('/documents/create-tickets', data)
export const previewTicketsFromBRD = (data) => api.post('/documents/preview-tickets', data)
export const confirmTickets = (data) => api.post('/documents/confirm-tickets', data)
export const confirmTicketsWithFiles = (payload) => {
  const fd = new FormData()
  fd.append('project_id', payload.project_id)
  fd.append('version_id', payload.version_id || '')
  fd.append('tickets_json', JSON.stringify(payload.tickets || []))
  ;(payload.files || []).forEach((f) => fd.append('files', f))
  return api.post('/documents/confirm-tickets-with-files', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// Sprint
export const getSprintHealth = (projectId, versionId) =>
  api.get('/sprint/health', { params: { ...(projectId && { project_id: projectId }), ...(versionId && { version_id: versionId }) } })
export const getTickets = (projectId, versionId) =>
  api.get('/sprint/tickets', { params: { ...(projectId && { project_id: projectId }), ...(versionId && { version_id: versionId }) } })
export const getTicketStats = (projectId, versionId) =>
  api.get('/sprint/stats', { params: { ...(projectId && { project_id: projectId }), ...(versionId && { version_id: versionId }) } })
export const getTicketDetail = (ticketId) => api.get(`/sprint/tickets/${ticketId}`)
export const getTicketAnalysis = (ticketId, projectId, versionId) =>
  api.get(`/sprint/tickets/${ticketId}/analysis`, {
    params: { ...(projectId && { project_id: projectId }), ...(versionId && { version_id: versionId }) },
  })
export const getProjects = () => api.get('/sprint/projects')
export const getVersions = (projectId) => api.get('/sprint/versions', { params: { project_id: projectId } })
export const getProjectUsers = (projectId) => api.get('/sprint/users', { params: projectId ? { project_id: projectId } : {} })
export const getProjectWorkPackageTypes = (projectId) =>
  api.get('/sprint/work-package-types', { params: { project_id: projectId } })
export const addAIComment = (ticketId) => api.post(`/sprint/tickets/${ticketId}/comment`)
export const generateRetrospective = (projectId, versionId) =>
  api.get('/sprint/retrospective', {
    params: {
      ...(projectId && { project_id: projectId }),
      ...(versionId && { version_id: versionId }),
    },
  })

// Reports
export const generateStatusReport = (data) => api.post('/reports/generate', data)
export const getQuickSummary = (projectId) =>
  api.get('/reports/quick-summary', { params: projectId ? { project_id: projectId } : {} })

// Auth
export const signup = (data) => api.post('/auth/signup', data)
export const login = (data) => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')

// User Comments
export const addUserComment = (ticketId, comment) => {
  const fd = new FormData()
  fd.append('comment', comment)
  return api.post(`/sprint/tickets/${ticketId}/comment/user`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const attachFileToTicket = (ticketId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/sprint/tickets/${ticketId}/attachment`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export default api

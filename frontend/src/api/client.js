import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
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

// Sprint
export const getSprintHealth = (projectId) =>
  api.get('/sprint/health', { params: projectId ? { project_id: projectId } : {} })
export const getTickets = (projectId) =>
  api.get('/sprint/tickets', { params: projectId ? { project_id: projectId } : {} })
export const getProjects = () => api.get('/sprint/projects')
export const addAIComment = (ticketId) => api.post(`/sprint/tickets/${ticketId}/comment`)
export const generateRetrospective = () => api.get('/sprint/retrospective')

// Reminders
export const getReminders = () => api.get('/reminders/')
export const evaluateReminders = (projectId) =>
  api.post('/reminders/evaluate', null, { params: projectId ? { project_id: projectId } : {} })
export const acknowledgeReminder = (id) => api.post(`/reminders/${id}/acknowledge`)
export const getReminderStats = () => api.get('/reminders/stats')

// Reports
export const generateStatusReport = (data) => api.post('/reports/generate', data)
export const getQuickSummary = (projectId) =>
  api.get('/reports/quick-summary', { params: projectId ? { project_id: projectId } : {} })

export default api

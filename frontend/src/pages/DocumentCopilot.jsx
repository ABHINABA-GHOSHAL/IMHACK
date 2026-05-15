import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { FileText, Sparkles, RefreshCw, Download, Plus, CheckCircle, Loader2, ChevronDown } from 'lucide-react'
import { generateDocument, refineDocument, ingestDocument, createTicketsFromBRD } from '../api/client'

const DOC_TYPES = [
  'BRD', 'SOW', 'Sprint Planning Document', 'Project Proposal', 'Internal Memo', 'Meeting Agenda'
]

const INITIAL_FORM = {
  doc_type: 'BRD',
  problem: '',
  users: '',
  success_metric: '',
  deadline: '',
  teams: '',
  priority: '',
  additional_context: '',
}

const FIELD_CONFIG = [
  { key: 'problem', label: 'What problem are you solving?', placeholder: 'e.g., Sellers don\'t know which catalog improvements increase their leads', rows: 2 },
  { key: 'users', label: 'Who are the users?', placeholder: 'e.g., Active sellers on IndiaMart premium plans (~100K users)', rows: 1 },
  { key: 'success_metric', label: 'What is the success metric?', placeholder: 'e.g., 20% increase in seller inquiry rate within 60 days', rows: 1 },
  { key: 'deadline', label: 'What is the deadline?', placeholder: 'e.g., June 30, 2026', rows: 1 },
  { key: 'teams', label: 'Which teams are involved?', placeholder: 'e.g., Product, Engineering (Backend + Frontend), Data Science', rows: 1 },
  { key: 'priority', label: 'What is the priority?', placeholder: 'e.g., High — tied to Q2 seller retention OKR', rows: 1 },
]

function SourceBadge({ source }) {
  const score = Math.round((source.relevance || 0) * 100)
  return (
    <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
      <span className="text-slate-600 font-medium truncate">{source.title}</span>
      <span className="ml-auto text-indigo-500 font-bold">{score}%</span>
    </div>
  )
}

export default function DocumentCopilot() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [doc, setDoc] = useState(null)
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [refineText, setRefineText] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)
  const [ingestDone, setIngestDone] = useState(false)
  const [ticketsCreated, setTicketsCreated] = useState(null)
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [error, setError] = useState('')
  const [projectId, setProjectId] = useState('1')

  const handleGenerate = async () => {
    if (!form.problem || !form.users || !form.success_metric || !form.deadline || !form.teams || !form.priority) {
      setError('Please fill in all 6 required fields.')
      return
    }
    setError('')
    setLoading(true)
    setDoc(null)
    setSources([])
    try {
      const res = await generateDocument(form)
      setDoc(res.data.content)
      setSources(res.data.sources || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefine = async () => {
    if (!refineText.trim() || !doc) return
    setRefineLoading(true)
    try {
      const res = await refineDocument({
        current_document: doc,
        refinement_instruction: refineText,
        doc_type: form.doc_type,
      })
      setDoc(res.data.content)
      setRefineText('')
    } catch (e) {
      setError(e.message)
    } finally {
      setRefineLoading(false)
    }
  }

  const handleIngest = async () => {
    if (!doc) return
    try {
      await ingestDocument({
        content: doc,
        doc_type: form.doc_type,
        title: `${form.doc_type} - ${form.problem.slice(0, 50)}`,
      })
      setIngestDone(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleCreateTickets = async () => {
    if (!doc || !projectId) return
    setTicketsLoading(true)
    try {
      const res = await createTicketsFromBRD({ brd_content: doc, project_id: projectId })
      setTicketsCreated(res.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setTicketsLoading(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([doc], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.doc_type.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <FileText size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Document Drafting Copilot</h1>
          <p className="text-sm text-slate-500">Answer 6 questions → AI generates a complete, RAG-grounded document in seconds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-700 mb-4 text-sm">Document Type</h2>
            <div className="relative">
              <select
                value={form.doc_type}
                onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white pr-8"
              >
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-700 text-sm">6-Question Brief</h2>
            {FIELD_CONFIG.map(({ key, label, placeholder, rows }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <textarea
                  rows={rows}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Additional Context (optional)</label>
              <textarea
                rows={2}
                value={form.additional_context}
                onChange={(e) => setForm({ ...form, additional_context: e.target.value })}
                placeholder="Any extra context..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300"
              />
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? 'Generating...' : `Generate ${form.doc_type}`}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Sources */}
          {sources.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                RAG Sources Used ({sources.length})
              </h3>
              <div className="space-y-1.5">
                {sources.map((s, i) => <SourceBadge key={i} source={s} />)}
              </div>
            </div>
          )}

          {/* Document output */}
          {loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
              <p className="text-sm text-slate-500">Retrieving historical examples and generating {form.doc_type}...</p>
            </div>
          )}

          {doc && !loading && (
            <>
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-700 text-sm">Generated {form.doc_type}</h3>
                  <div className="flex items-center gap-2">
                    {ingestDone ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle size={14} />Saved to KB
                      </span>
                    ) : (
                      <button onClick={handleIngest} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                        <Plus size={13} />Save to Knowledge Base
                      </button>
                    )}
                    <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium">
                      <Download size={13} />Download
                    </button>
                  </div>
                </div>
                <div className="p-5 max-h-[500px] overflow-y-auto">
                  <div className="markdown-content">
                    <ReactMarkdown>{doc}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Refine */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <RefreshCw size={14} className="text-indigo-500" />Refine Document
                </h3>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    placeholder='e.g., "Make success metrics more specific" or "Add a risks section"'
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    onClick={handleRefine}
                    disabled={refineLoading || !refineText.trim()}
                    className="px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
                  >
                    {refineLoading ? <Loader2 size={16} className="animate-spin" /> : 'Apply'}
                  </button>
                </div>
              </div>

              {/* Create Tickets */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Create Tickets in OpenProject</h3>
                <div className="flex gap-2 items-center">
                  <input
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="Project ID"
                    className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    onClick={handleCreateTickets}
                    disabled={ticketsLoading}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {ticketsLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {ticketsLoading ? 'Creating...' : 'Extract & Create Tickets'}
                  </button>
                </div>
                {ticketsCreated && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-700 font-medium">
                      {ticketsCreated.created} ticket(s) created in OpenProject
                    </p>
                    <div className="mt-2 space-y-1">
                      {ticketsCreated.tickets?.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-emerald-600">
                          <CheckCircle size={12} />{t.id} — {t.subject}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!doc && !loading && (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 flex flex-col items-center gap-3 text-center">
              <FileText size={40} className="text-slate-300" />
              <p className="text-slate-400 text-sm">Fill in the brief on the left and click Generate</p>
              <p className="text-slate-300 text-xs">The AI will retrieve similar past documents and generate a complete {form.doc_type}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

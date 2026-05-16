import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { jsPDF } from "jspdf"
import {
  FileText, Sparkles, Download, Plus, CheckCircle, Trash2,
  Loader2, ChevronDown, Database, Zap, Send, Eye, Pencil, RefreshCw, X,
  Maximize2,
} from "lucide-react"
import {
  generateDocument, refineDocument, ingestDocument,
  previewTicketsFromBRD, confirmTickets,
  getProjects, getVersions, getProjectUsers, getProjectWorkPackageTypes,
} from "../api/client"

const DOC_TYPES = ["BRD", "SOW", "Sprint Planning Document", "Project Proposal", "Internal Memo", "Meeting Agenda"]
const PRIORITIES = ["High", "Medium", "Low"]
const TEAMS = ["Product", "Engineering", "Design", "Data Science", "QA", "All"]

const INITIAL = {
  doc_type: "BRD", problem: "", users: "", success_metric: "",
  deadline: "", teams: "", priority: "", additional_context: "",
}

const TICKET_PREF_OPTIONS = {
  type: ["Task", "Feature", "Bug", "Spike", "Improvement", "Epic"],
  priority: ["High", "Medium", "Low"],
  team: ["Engineering", "Product", "Design", "QA", "Data Science"],
  component: ["WA96 Bot", "WA Backend", "NLP/LLM", "Analytics", "Integrations", "Infra"],
  effortPoints: ["1", "2", "3", "5", "8", "13"],
  risk: ["Low", "Medium", "High"],
}

const FIELDS = [
  { key: "problem",        label: "What problem are you solving?",  placeholder: "e.g., Sellers don't know which catalog improvements increase their leads", rows: 2 },
  { key: "users",          label: "Who are the users?",             placeholder: "e.g., Active sellers on IndiaMart premium plans (~100K users)",           rows: 1 },
  { key: "success_metric", label: "What is the success metric?",    placeholder: "e.g., 20% increase in seller inquiry rate within 60 days",                rows: 1 },
  { key: "deadline",       label: "What is the deadline?",          placeholder: "e.g., June 30, 2026",                                                     rows: 1 },
  { key: "teams",          label: "Which teams are involved?",      placeholder: "e.g., Product, Engineering (Backend + Frontend), Data Science",            rows: 1 },
  { key: "priority",       label: "What is the priority?",          placeholder: "e.g., High — tied to Q2 seller retention OKR",                            rows: 1 },
]

const cleanBrdContext = (rawText = "") => {
  let text = String(rawText || "").trim()
  if (!text) return ""

  text = text
    .replace(/^\s*AI\s*BRD\s*Draft\s*Context\s*$/gim, "")
    .replace(/^\s*BRD\s*:\s*.*$/gim, "")
    .replace(/^\s*Priority\s*:\s*.*$/gim, "")
    .replace(/^\s*Status\s*:\s*.*$/gim, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  const marker = "## BUSINESS PROBLEM"
  const idx = text.indexOf(marker)
  if (idx >= 0) text = text.slice(idx)

  text = text.replace(/(^|\n)\s*(?:##\s*)?Source\s+References\s*:?\s*[\s\S]*$/i, "").trim()
  return text
}

export default function DocumentCopilot() {
  const [form, setForm]                 = useState(INITIAL)
  const [doc, setDoc]                   = useState(null)
  const [sources, setSources]           = useState([])
  const [loading, setLoading]           = useState(false)
  const [refineText, setRefineText]     = useState("")
  const [refineLoading, setRefLoading]  = useState(false)
  const [ingestDone, setIngestDone]     = useState(false)
  const [error, setError]               = useState("")

  // Ticket creation state
  const [projects,       setProjects]       = useState([])
  const [versions,       setVersions]       = useState([])
  const [projectId,      setProjectId]      = useState("")
  const [versionId,      setVersionId]      = useState("")
  const [workPackageTypes, setWorkPackageTypes] = useState([])
  const [projectSearch,  setProjectSearch]  = useState("")
  const [projectsErr,    setProjectsErr]    = useState("")
  const [users,          setUsers]          = useState([])
  const [usersErr,       setUsersErr]       = useState("")
  const [ticketPrefs,    setTicketPrefs]    = useState({
    type: "Task",
    priority: "Medium",
    team: "Engineering",
    component: "WA96 Bot",
    effortPoints: "3",
    risk: "Medium",
  })
  const [draftTicket,    setDraftTicket]    = useState(null)   // single preview ticket
  const [showTicketModal, setShowTicketModal] = useState(false)  // full-screen review modal
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmedTickets, setConfirmedTickets] = useState(null)  // sent step
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Load projects
  useEffect(() => {
    getProjects()
      .then((r) => {
        const list = r.data.projects || []
        console.log("[DocumentCopilot] projects loaded:", list.length, list.map((p) => p.name))
        setProjects(list)
        if (list.length) setProjectId(String(list[0].id))
        else setProjectsErr("No projects returned")
      })
      .catch((e) => {
        console.error("[DocumentCopilot] get_projects failed:", e.message)
        setProjectsErr(e.message)
      })
  }, [])

  // Load versions when project changes
  useEffect(() => {
    if (!projectId) return
    setVersionId("")
    getVersions(projectId)
      .then((r) => {
        const vlist = r.data.versions || []
        console.log("[DocumentCopilot] versions for project", projectId, ":", vlist.length, vlist.map((v) => v.name))
        setVersions(vlist)
      })
      .catch((e) => {
        console.error("[DocumentCopilot] get_versions failed:", e.message)
        setVersions([])
      })

    getProjectUsers(projectId)
      .then((r) => {
        const list = r.data.users || []
        setUsers(list)
        setUsersErr("")
      })
      .catch((e) => {
        console.error("[DocumentCopilot] get_users failed:", e.message)
        setUsers([])
        setUsersErr(e.message)
      })

    getProjectWorkPackageTypes(projectId)
      .then((r) => {
        const list = r.data.types || []
        setWorkPackageTypes(list)
        if (list.length) {
          const names = list.map((x) => x.name)
          if (!names.includes(ticketPrefs.type)) {
            const preferred = list.find((x) => x.is_default)?.name || list[0].name
            setTicketPrefs((p) => ({ ...p, type: preferred }))
          }
        }
      })
      .catch(() => setWorkPackageTypes([]))
  }, [projectId])

  const typeOptions = workPackageTypes.length ? workPackageTypes.map((x) => x.name) : TICKET_PREF_OPTIONS.type

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleGenerate = async () => {
    if (form.doc_type === "BRD" && !form.problem.trim()) {
      setError("Please provide a natural-language BRD brief.")
      return
    }
    const missing = form.doc_type !== "BRD" && FIELDS.some(({ key }) => !form[key])
    if (missing) { setError("Please fill in all 6 required fields."); return }
    setError(""); setLoading(true); setDoc(null); setSources([])
    setDraftTicket(null); setConfirmedTickets(null)
    try {
      const payload = {
        ...form,
        users: form.users || "Not specified",
        success_metric: form.success_metric || "Not specified",
        deadline: form.deadline || "Not specified",
        teams: form.teams || "Not specified",
        priority: form.priority || "Medium",
      }
      const r = await generateDocument(payload)
      setDoc(r.data.content); setSources(r.data.sources || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleRefine = async () => {
    if (!refineText.trim() || !doc) return
    setRefLoading(true)
    try {
      const r = await refineDocument({ current_document: doc, refinement_instruction: refineText, doc_type: form.doc_type })
      setDoc(r.data.content); setRefineText("")
    } catch (e) { setError(e.message) }
    finally { setRefLoading(false) }
  }

  const handleIngest = async () => {
    if (!doc) return
    try {
      await ingestDocument({ content: doc, doc_type: form.doc_type, title: `${form.doc_type} - ${form.problem.slice(0, 50)}` })
      setIngestDone(true)
    } catch (e) { setError(e.message) }
  }

  // Step 1 — AI extracts single draft ticket (no creation)
  const handlePreviewTickets = async () => {
    if (!doc) return
    setPreviewLoading(true); setDraftTicket(null); setConfirmedTickets(null)
    try {
      const r = await previewTicketsFromBRD({ brd_content: doc, ticket_preferences: ticketPrefs })
      const ticket = r.data.ticket || {}
      setDraftTicket({
        ...ticket,
        ai_brd_draft: cleanBrdContext(ticket.ai_brd_draft || doc),
      })
      setShowTicketModal(true)
    } catch (e) { setError(e.message) }
    finally { setPreviewLoading(false) }
  }

  const patchTicketPref = (k, v) => setTicketPrefs((p) => ({ ...p, [k]: v }))

  const resolveAssigneeName = (id) => users.find((u) => String(u.id) === String(id))?.name || null

  // Patch single draft ticket field
  const patchDraft = (key, val) => setDraftTicket((t) => ({ ...t, [key]: val }))

  // Step 2 — PM sends approved ticket to OpenProject
  const handleConfirmTickets = async () => {
    if (!draftTicket || !projectId) return
    setConfirmLoading(true)
    try {
      const tickets = [{
        ...draftTicket,
        ai_brd_draft: cleanBrdContext(draftTicket.ai_brd_draft || doc),
      }]
      const r = await confirmTickets({ project_id: projectId, version_id: versionId || undefined, tickets })
      setConfirmedTickets(r.data)
      setDraftTicket(null)
      setShowTicketModal(false)
    } catch (e) { setError(e.message) }
    finally { setConfirmLoading(false) }
  }

  const handleDownload = () => {
    const blob = new Blob([doc], { type: "text/markdown" })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement("a"), { href: url, download: `${form.doc_type.replace(/\s+/g, "_")}.md` })
    a.click(); URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    if (!doc) return
    const pdf = new jsPDF({ unit: "pt", format: "a4" })
    const margin = 40
    const maxWidth = 515
    const lines = pdf.splitTextToSize(doc, maxWidth)
    let y = 48
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(14)
    pdf.text(`${form.doc_type} - Generated`, margin, y)
    y += 24
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    lines.forEach((line) => {
      if (y > 790) {
        pdf.addPage()
        y = 48
      }
      pdf.text(line, margin, y)
      y += 14
    })
    pdf.save(`${form.doc_type.replace(/\s+/g, "_")}.pdf`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-0">
      {/* ── Full-Screen Ticket Review Modal ── */}
      {showTicketModal && draftTicket && (
        <div
          className="fixed inset-0 z-50 p-3 sm:p-6"
          style={{ background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", borderBottom: "1px solid #fde68a" }}
            >
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-amber-600" />
                <span className="font-bold text-amber-800 text-base">PM Review — Draft Ticket</span>
              </div>
              <button
                onClick={() => setShowTicketModal(false)}
                className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Title *</label>
                <input
                  value={draftTicket.title}
                  onChange={(e) => patchDraft("title", e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Ticket title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Description</label>
                <textarea
                  rows={5}
                  value={draftTicket.description}
                  onChange={(e) => patchDraft("description", e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Detailed description, acceptance criteria, business impact…"
                />
              </div>

              {/* Row 1: Type, Priority, Team */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Type</label>
                  <select
                    value={draftTicket.type || "Task"}
                    onChange={(e) => patchDraft("type", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {typeOptions.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Priority</label>
                  <select
                    value={draftTicket.priority}
                    onChange={(e) => patchDraft("priority", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {TICKET_PREF_OPTIONS.priority.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Team</label>
                  <select
                    value={draftTicket.team}
                    onChange={(e) => patchDraft("team", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {TICKET_PREF_OPTIONS.team.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Component, Effort Points, Estimated Days, Risk */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Component</label>
                  <select
                    value={draftTicket.component}
                    onChange={(e) => patchDraft("component", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {TICKET_PREF_OPTIONS.component.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Effort Pts</label>
                  <select
                    value={String(draftTicket.effortPoints || 3)}
                    onChange={(e) => patchDraft("effortPoints", Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {TICKET_PREF_OPTIONS.effortPoints.map((x) => <option key={x} value={x}>{x} pts</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Est. Days</label>
                  <input
                    type="number" min="1" max="90"
                    value={draftTicket.estimatedDays}
                    onChange={(e) => patchDraft("estimatedDays", Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Risk</label>
                  <select
                    value={draftTicket.risk}
                    onChange={(e) => patchDraft("risk", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {TICKET_PREF_OPTIONS.risk.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Assignee {users.length === 0 && <span className="text-amber-500 normal-case font-normal">(loading…)</span>}
                </label>
                <select
                  value={draftTicket.assignee_id || ""}
                  onChange={(e) => {
                    const val = e.target.value || null
                    patchDraft("assignee_id", val)
                    patchDraft("assignee_name", resolveAssigneeName(val))
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">— Unassigned —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Accountable</label>
                  <select
                    value={draftTicket.responsible_id || ""}
                    onChange={(e) => {
                      const val = e.target.value || null
                      patchDraft("responsible_id", val)
                      patchDraft("responsible_name", resolveAssigneeName(val))
                    }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">— Not set —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Estimated Hours</label>
                  <input
                    type="number" min="1" max="400"
                    value={draftTicket.estimatedHours || Math.max(8, Number(draftTicket.estimatedDays || 1) * 8)}
                    onChange={(e) => patchDraft("estimatedHours", Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* Target project/version info */}
              <div className="rounded-xl px-4 py-3 text-xs text-slate-600" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span className="font-semibold text-slate-700">Target: </span>
                {projects.find((p) => String(p.id) === String(projectId))?.name || projectId || "No project selected"}
                {versionId && versions.find((v) => String(v.id) === String(versionId)) && (
                  <> › <span className="font-semibold">{versions.find((v) => String(v.id) === String(versionId))?.name}</span></>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">BRD Draft</p>
                <div className="max-h-72 overflow-y-auto markdown-content text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {cleanBrdContext(draftTicket.ai_brd_draft || doc) || "No BRD draft available."}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
              style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() => setShowTicketModal(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTickets}
                disabled={confirmLoading || !projectId || !draftTicket?.title?.trim()}
                className="flex items-center gap-2 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
              >
                {confirmLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {confirmLoading ? "Creating…" : "Confirm & Create in OpenProject"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#eef2ff,#e0e7ff)" }}
        >
          <FileText size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Document Drafting Copilot</h1>
          <p className="text-sm text-slate-400">
            For BRD, describe in natural language — AI structures it and prepares task previews
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Form ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Doc Type */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Document Type</p>
            <div className="relative">
              <select
                value={form.doc_type}
                onChange={(e) => patch("doc_type", e.target.value)}
                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white pr-8"
              >
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* BRD / 6-Question Brief */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {form.doc_type === "BRD" ? "Natural Language BRD Brief" : "6-Question Brief"}
            </p>

            {form.doc_type === "BRD" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Describe the BRD in natural language
                </label>
                <textarea
                  rows={8}
                  value={form.problem}
                  onChange={(e) => patch("problem", e.target.value)}
                  placeholder="Paste your business context naturally. AI will structure output under BUSINESS PROBLEM, BUSINESS REQUIREMENTS, EXPECTED IMPACT."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300 text-slate-700"
                />
              </div>
            ) : (
              FIELDS.map(({ key, label, placeholder, rows }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                  <textarea
                    rows={rows}
                    value={form[key]}
                    onChange={(e) => patch(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300 text-slate-700"
                  />
                </div>
              ))
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Additional Context <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={form.additional_context}
                onChange={(e) => patch("additional_context", e.target.value)}
                placeholder="Any extra context or constraints..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300 text-slate-700"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Generating…" : `Generate ${form.doc_type}`}
            </button>
          </div>
        </div>

        {/* ── Output ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* RAG Sources */}
          {sources.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Database size={11} className="text-indigo-400" />
                RAG Sources Used ({sources.length})
              </p>
              <div className="space-y-1.5">
                {sources.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 text-xs rounded-lg px-3 py-2"
                    style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-slate-600 font-medium truncate flex-1">{s.title}</span>
                    <span className="font-bold text-indigo-500 shrink-0">
                      {Math.round((s.relevance || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-14 flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
              <p className="text-sm text-slate-500 text-center">
                Retrieving historical examples and generating your {form.doc_type}…
              </p>
            </div>
          )}

          {/* Empty */}
          {!doc && !loading && (
            <div
              className="bg-white rounded-xl border-2 border-dashed p-16 flex flex-col items-center gap-3 text-center"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#eef2ff,#e0e7ff)" }}
              >
                <FileText size={22} className="text-indigo-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Fill the brief and click Generate</p>
              <p className="text-xs text-slate-400">AI will create a complete, grounded document in ~15 seconds</p>
            </div>
          )}

          {/* Document */}
          {doc && !loading && (
            <>
              <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-500" />
                    <span className="font-bold text-slate-700 text-sm">Generated {form.doc_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ingestDone ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle size={12} />Saved to KB
                      </span>
                    ) : (
                      <button
                        onClick={handleIngest}
                        className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} />Save to KB
                      </button>
                    )}
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}
                    >
                      <Download size={12} />Download
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#4338ca" }}
                    >
                      <Download size={12} />Download PDF
                    </button>
                  </div>
                </div>
                <div className="p-6 max-h-[520px] overflow-y-auto">
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full border-collapse text-sm" {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }) => (
                          <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="border border-slate-200 px-3 py-2 align-top text-slate-600" {...props} />
                        ),
                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3" {...props} />,
                        p: ({ node, ...props }) => <p className="text-slate-600 leading-7 mb-3" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-2 text-slate-600" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-2 text-slate-600" {...props} />,
                        li: ({ node, ...props }) => <li className="leading-7" {...props} />,
                      }}
                    >
                      {doc}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Refine */}
              <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <RefreshCw size={11} className="text-indigo-400" />Refine Document
                </p>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    placeholder='e.g., "Make success metrics more specific" or "Add a risks section"'
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 placeholder:text-slate-300"
                  />
                  <button
                    onClick={handleRefine}
                    disabled={refineLoading || !refineText.trim()}
                    className="px-4 text-white text-sm font-bold rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
                  >
                    {refineLoading ? <Loader2 size={16} className="animate-spin" /> : "Apply"}
                  </button>
                </div>
              </div>

              {/* ── Step 1: Target selectors + Preview ── */}
              <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Zap size={11} className="text-emerald-400" />Create Tickets in OpenProject
                </p>

                {/* Project + Bucket dropdowns */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {projects.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Filter…"
                        className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder:text-slate-300"
                      />
                      <div className="relative">
                        <select
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 max-w-[200px]"
                        >
                          {projects
                            .filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                            .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                          }
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <span className="text-[10px] text-slate-400">{projects.length} projects</span>
                    </div>
                  ) : projectsErr ? (
                    <div className="space-y-1">
                      <p className="text-xs text-amber-600 font-medium">{projectsErr}</p>
                      <input
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        placeholder="Enter project ID manually"
                        className="w-48 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-700"
                      />
                    </div>
                  ) : (
                    <input
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      placeholder="Project ID"
                      className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 text-slate-700"
                    />
                  )}

                  {versions.length > 0 && (
                    <div className="relative">
                      <select
                        value={versionId}
                        onChange={(e) => setVersionId(e.target.value)}
                        className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      >
                        <option value="">No Bucket</option>
                        {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Type</label>
                    <select value={ticketPrefs.type} onChange={(e) => patchTicketPref("type", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      {typeOptions.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Priority</label>
                    <select value={ticketPrefs.priority} onChange={(e) => patchTicketPref("priority", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      {TICKET_PREF_OPTIONS.priority.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Team</label>
                    <select value={ticketPrefs.team} onChange={(e) => patchTicketPref("team", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      {TICKET_PREF_OPTIONS.team.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Component</label>
                    <select value={ticketPrefs.component} onChange={(e) => patchTicketPref("component", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      {TICKET_PREF_OPTIONS.component.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Effort Points</label>
                    <select value={ticketPrefs.effortPoints} onChange={(e) => patchTicketPref("effortPoints", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      {TICKET_PREF_OPTIONS.effortPoints.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Risk</label>
                    <select value={ticketPrefs.risk} onChange={(e) => patchTicketPref("risk", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      {TICKET_PREF_OPTIONS.risk.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                </div>

                {usersErr && <p className="text-[11px] text-amber-600 mb-2">Could not fetch assignees: {usersErr}</p>}
                {!usersErr && users.length > 0 && (
                  <p className="text-[11px] text-slate-400 mb-2">Assignee will be selected per ticket in PM Review ({users.length} users loaded).</p>
                )}

                <button
                  onClick={handlePreviewTickets}
                  disabled={previewLoading || !doc}
                  className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                  style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
                >
                  {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  {previewLoading ? "Generating Ticket…" : "Step 1 — AI Generate Ticket"}
                </button>
                <p className="text-[11px] text-slate-400 mt-1.5">AI creates one ticket from the {form.doc_type} — review before sending</p>
              </div>

              {/* ── Step 2: Ticket ready banner ── */}
              {draftTicket && !showTicketModal && (
                <div
                  className="rounded-xl border p-4 flex items-center justify-between gap-3"
                  style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1px solid #fde68a" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Eye size={16} className="text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-800 truncate">{draftTicket.title}</p>
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        {draftTicket.type} · {draftTicket.priority} priority · {draftTicket.estimatedDays}d estimate
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTicketModal(true)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl shrink-0"
                    style={{ background: "#f59e0b", color: "#fff" }}
                  >
                    <Maximize2 size={13} />
                    Review Full Ticket
                  </button>
                </div>
              )}

              {/* ── Step 3: Confirmed ── */}
              {confirmedTickets && (
                <div
                  className="rounded-xl border p-4"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-800">
                      {confirmedTickets.created} ticket(s) created in OpenProject
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {confirmedTickets.tickets?.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-emerald-700 bg-white rounded-lg px-3 py-1.5 border border-emerald-100">
                        <CheckCircle size={11} className="shrink-0" />
                        <span className="font-bold">{t.id}</span>
                        <span className="text-emerald-600">{t.subject || t.title}</span>
                        {t.team && <span className="ml-auto text-emerald-500">{t.team}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

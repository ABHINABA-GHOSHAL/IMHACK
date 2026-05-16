import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { jsPDF } from "jspdf"
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Download,
  FileText,
  Maximize2,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { getProjects, getVersions, getTickets, getTicketAnalysis, getTicketDetail, addUserComment, attachFileToTicket } from "../api/client"

function InfoPill({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-semibold text-slate-700 mt-0.5 truncate">{value || "—"}</p>
    </div>
  )
}

function TicketCard({ ticket, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${active ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{ticket.id}</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ticket.subject}</p>
        </div>
        <ArrowRight size={14} className={active ? "text-indigo-500" : "text-slate-300"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ticket.status}</span>
        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{ticket.type_name || "Task"}</span>
        {ticket.assignee && <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{ticket.assignee}</span>}
      </div>
    </button>
  )
}

export default function TicketAnalysis() {
  const [projects, setProjects] = useState([])
  const [versions, setVersions] = useState([])
  const [tickets, setTickets] = useState([])
  const [projectId, setProjectId] = useState("")
  const [versionId, setVersionId] = useState("")
  const [assignee, setAssignee] = useState("")
  const [textFilter, setTextFilter] = useState("")
  const [sortBy, setSortBy] = useState("id")
  const [sortOrder, setSortOrder] = useState("asc")
  const [ticketId, setTicketId] = useState("")
  const [analysisTicketId, setAnalysisTicketId] = useState("")
  const [ticketDetail, setTicketDetail] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState("")
  const [newComment, setNewComment] = useState("")
  const [commentLoading, setCommentLoading] = useState(false)
  const [fileToAttach, setFileToAttach] = useState(null)
  const [attachLoading, setAttachLoading] = useState(false)
  const analysisPdfRef = useRef(null)

  useEffect(() => {
    getProjects()
      .then((r) => {
        const list = r.data.projects || []
        setProjects(list)
        if (list.length) setProjectId(String(list[0].id))
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!projectId) return
    setVersionId("")
    setAssignee("")
    setTextFilter("")
    setTicketId("")
    setAnalysisTicketId("")
    setTicketDetail(null)
    setAnalysis(null)
    setShowAnalysisModal(false)
    getVersions(projectId)
      .then((r) => setVersions(r.data.versions || []))
      .catch(() => setVersions([]))
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    setLoadingTickets(true)
    setError("")
    getTickets(projectId, versionId || undefined)
      .then((r) => {
        const list = r.data.tickets || []
        setTickets(list)
        if (!ticketId && list.length) setTicketId(list[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingTickets(false))
  }, [projectId, versionId])

  const assignees = useMemo(() => {
    const map = new Map()
    tickets.forEach((t) => {
      if (t.assignee) map.set(t.assignee, true)
    })
    return [...map.keys()].sort()
  }, [tickets])

  const filteredTickets = useMemo(() => {
    const normalized = tickets.filter((t) => {
      const haystack = `${t.id || ""} ${t.subject || ""} ${t.status || ""} ${t.assignee || ""} ${t.version_name || ""}`.toLowerCase()
      if (textFilter && !haystack.includes(textFilter.toLowerCase().trim())) return false
      if (assignee && (t.assignee || "") !== assignee) return false
      return true
    })

    const toIdNum = (id) => {
      const m = String(id || "").match(/(\d+)/)
      return m ? Number(m[1]) : 0
    }
    const toTime = (v) => {
      const t = Date.parse(v || "")
      return Number.isNaN(t) ? 0 : t
    }

    normalized.sort((a, b) => {
      let cmp = 0
      if (sortBy === "created_at") {
        cmp = toTime(a.created_at) - toTime(b.created_at)
      } else {
        cmp = toIdNum(a.id) - toIdNum(b.id)
      }
      return sortOrder === "asc" ? cmp : -cmp
    })

    return normalized
  }, [tickets, textFilter, assignee, sortBy, sortOrder])

  useEffect(() => {
    if (!filteredTickets.length) {
      setTicketId("")
      setAnalysisTicketId("")
      setTicketDetail(null)
      setAnalysis(null)
      setShowAnalysisModal(false)
      return
    }
    const stillVisible = filteredTickets.some((t) => t.id === ticketId)
    if (!ticketId || !stillVisible) setTicketId(filteredTickets[0].id)
  }, [filteredTickets, ticketId])

  useEffect(() => {
    if (!ticketId) {
      setTicketDetail(null)
      return
    }
    let cancelled = false
    const loadTicketDetail = async () => {
      setLoadingTicketDetail(true)
      setError("")
      try {
        const r = await getTicketDetail(ticketId)
        if (!cancelled) setTicketDetail(r.data)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoadingTicketDetail(false)
      }
    }
    loadTicketDetail()
    return () => {
      cancelled = true
    }
  }, [ticketId])

  const selectedTicket = ticketDetail?.ticket || filteredTickets.find((t) => t.id === ticketId) || null
  const ticketComments = ticketDetail?.comments || analysis?.comments || []

  const handleAnalyze = async () => {
    if (!ticketId) return
    setLoadingAnalysis(true)
    setError("")
    try {
      const r = await getTicketAnalysis(ticketId, projectId || undefined, versionId || undefined)
      setAnalysis(r.data)
      setAnalysisTicketId(ticketId)
      setShowAnalysisModal(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const handleDownloadAnalysisPdf = async () => {
    if (!analysis?.analysis || !selectedTicket) return
    const renderedNode = analysisPdfRef.current
    if (!renderedNode) return
    const pdf = new jsPDF({ unit: "pt", format: "a4" })

    const container = document.createElement("div")
    container.style.position = "fixed"
    container.style.left = "0"
    container.style.top = "0"
    container.style.width = "760px"
    container.style.background = "#ffffff"
    container.style.padding = "28px"
    container.style.color = "#0f172a"
    container.style.fontFamily = "Segoe UI, Arial, sans-serif"
    container.style.opacity = "0.01"
    container.style.pointerEvents = "none"
    container.style.zIndex = "-1"

    const title = document.createElement("h1")
    title.style.margin = "0 0 10px"
    title.style.fontSize = "24px"
    title.style.fontWeight = "800"
    title.style.lineHeight = "1.3"
    title.textContent = `${selectedTicket.id} - Ticket Analysis`

    const meta = document.createElement("p")
    meta.style.margin = "0 0 20px"
    meta.style.color = "#64748b"
    meta.style.fontSize = "12px"
    meta.textContent = `Generated ${new Date().toLocaleString()}`

    const article = document.createElement("article")
    article.className = "markdown-content"
    article.appendChild(renderedNode.cloneNode(true))

    container.appendChild(title)
    container.appendChild(meta)
    container.appendChild(article)
    document.body.appendChild(container)

    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
      await pdf.html(container, {
        margin: [24, 24, 24, 24],
        autoPaging: "text",
        x: 0,
        y: 0,
        width: 540,
        windowWidth: 760,
      })
      pdf.save(`${selectedTicket.id}_analysis.pdf`)
    } finally {
      document.body.removeChild(container)
    }
  }

  // Add user comment
  const handleAddComment = async () => {
    if (!ticketId || !newComment.trim()) return
    setCommentLoading(true)
    try {
      await addUserComment(ticketId, newComment)
      setNewComment("")
      // Refresh ticket detail to get new comments
      const r = await getTicketDetail(ticketId)
      setTicketDetail(r.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setCommentLoading(false)
    }
  }
  // Attach file
  const handleAttachFile = async () => {
    if (!ticketId || !fileToAttach) return
    setAttachLoading(true)
    try {
      await attachFileToTicket(ticketId, fileToAttach)
      setFileToAttach(null)
      // Refresh ticket detail to get new attachments (if shown in comments or elsewhere)
      const r = await getTicketDetail(ticketId)
      setTicketDetail(r.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setAttachLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#fff7ed,#fed7aa)" }}>
            <Search size={20} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Ticket Analysis</h1>
            <p className="text-sm text-slate-400">Filter by project, bucket, and assignee. Select one ticket to see its detail, comments, and AI analysis.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Project</p>
          <div className="relative">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bucket</p>
          <div className="relative">
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
              <option value="">All buckets</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Assignee</p>
          <div className="relative">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
              <option value="">All assignees</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Search Text</p>
          <div className="relative">
            <input
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Search ticket id, subject, status, assignee..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pl-9 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Sort By</p>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="id">Ticket ID</option>
              <option value="created_at">Creation Date</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Order</p>
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-200/70 bg-white shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <BarChart3 size={15} className="text-slate-400" />
          <span className="font-semibold text-slate-700">{filteredTickets.length}</span>
          <span>ticket(s) match the filters</span>
        </div>
        {(textFilter || assignee || versionId || sortBy !== "id" || sortOrder !== "asc") && (
          <button
            type="button"
            onClick={() => {
              setTextFilter("")
              setAssignee("")
              setVersionId("")
              setSortBy("id")
              setSortOrder("asc")
            }}
            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Original Ticket</p>
            {loadingTickets && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="max-h-[72vh] overflow-y-auto divide-y divide-slate-100">
            {filteredTickets.length === 0 && !loadingTickets && (
              <div className="p-6 text-sm text-slate-400">No tickets match the selected filters.</div>
            )}
            {filteredTickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                active={t.id === ticketId}
                onClick={() => {
                  setTicketId(t.id)
                  setAnalysis(null)
                  setAnalysisTicketId("")
                }}
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {selectedTicket && (
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Selected Ticket</p>
                  <h2 className="text-xl font-extrabold text-slate-800 mt-1">{selectedTicket.id}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedTicket.subject}</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <FileText size={13} /> {selectedTicket.type_name || "Task"}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <InfoPill label="Status" value={selectedTicket.status} />
                <InfoPill label="Assignee" value={selectedTicket.assignee} />
                <InfoPill label="Bucket" value={selectedTicket.version_name} />
                <InfoPill label="Due Date" value={selectedTicket.due_date} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Description</p>
                <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">{selectedTicket.description || "No description available."}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!ticketId || loadingAnalysis}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAnalysis ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Analyze Ticket
                </button>
                <p className="text-xs text-slate-400">
                  Analysis runs only when you click the button.
                </p>
                {analysis?.analysis && analysisTicketId === ticketId && (
                  <button
                    type="button"
                    onClick={() => setShowAnalysisModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Maximize2 size={13} />
                    Full Window
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Comments</p>
                <h3 className="text-lg font-bold text-slate-800 mt-1">Comment History</h3>
              </div>
              {loadingTicketDetail ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <MessageSquare size={16} className="text-slate-400" />}
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {ticketComments.length === 0 ? (
                <p className="text-sm text-slate-400">No comments available for this ticket.</p>
              ) : (
                ticketComments.map((comment, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-xs font-bold text-slate-700">{comment.author || "Unknown"}</p>
                      <p className="text-[11px] text-slate-400">{comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}</p>
                    </div>
                    <div className="text-sm text-slate-600 leading-6 prose prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-indigo-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.comment || ""}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Add comment input */}
            {selectedTicket && (
              <div className="mt-4 flex flex-col gap-2">
                <textarea
                  rows={2}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 text-slate-700 placeholder:text-slate-300"
                  disabled={commentLoading}
                />
                <button
                  onClick={handleAddComment}
                  disabled={commentLoading || !newComment.trim()}
                  className="self-end px-4 py-2 text-sm font-bold rounded-lg text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
                >
                  {commentLoading ? <Loader2 size={15} className="animate-spin inline-block mr-1" /> : null}
                  Add Comment
                </button>
              </div>
            )}
            {/* Attach file input */}
            {selectedTicket && (
              <div className="mt-4 flex flex-col gap-2">
                <input
                  type="file"
                  onChange={e => setFileToAttach(e.target.files[0])}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                  disabled={attachLoading}
                />
                <button
                  onClick={handleAttachFile}
                  disabled={attachLoading || !fileToAttach}
                  className="self-end px-4 py-2 text-sm font-bold rounded-lg text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
                >
                  {attachLoading ? <Loader2 size={15} className="animate-spin inline-block mr-1" /> : null}
                  Attach File
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-orange-500" />
                <p className="text-sm font-bold text-slate-700">AI Analysis</p>
              </div>
              {loadingAnalysis && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>
            <div className="p-5 max-h-[72vh] overflow-y-auto">
              {analysis?.analysis && analysisTicketId === ticketId ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse text-sm" {...props} /></div>
                    ),
                    th: ({ node, ...props }) => <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700" {...props} />,
                    td: ({ node, ...props }) => <td className="border border-slate-200 px-3 py-2 align-top text-slate-600" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-extrabold text-slate-900 mb-4" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-slate-800 mt-7 mb-3" {...props} />,
                    p: ({ node, ...props }) => <p className="text-slate-600 leading-7 mb-3" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-2 text-slate-600" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-2 text-slate-600" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-7" {...props} />,
                  }}
                >
                  {analysis.analysis}
                </ReactMarkdown>
              ) : ticketId ? (
                <p className="text-sm text-slate-400">Click Analyze Ticket to generate analysis for the currently selected ticket.</p>
              ) : loadingAnalysis ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Generating analysis from ticket details and comment history...
                </div>
              ) : (
                <p className="text-sm text-slate-400">Select a ticket to generate analysis.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAnalysisModal && analysis?.analysis && analysisTicketId === ticketId && (
        <div className="fixed inset-0 z-50 p-4 sm:p-6" style={{ background: "rgba(15,23,42,0.68)", backdropFilter: "blur(3px)" }}>
          <div className="w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3" style={{ background: "linear-gradient(135deg,#fff7ed,#ffedd5)" }}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400">Ticket Analysis</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedTicket?.id} {selectedTicket?.subject ? `- ${selectedTicket.subject}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAnalysisPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download size={13} />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowAnalysisModal(false)}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
              <div ref={analysisPdfRef} className="max-w-5xl mx-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse text-sm" {...props} /></div>
                    ),
                    th: ({ node, ...props }) => <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700" {...props} />,
                    td: ({ node, ...props }) => <td className="border border-slate-200 px-3 py-2 align-top text-slate-600" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-3xl font-extrabold text-slate-900 mb-5" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-slate-800 mt-8 mb-3" {...props} />,
                    p: ({ node, ...props }) => <p className="text-slate-600 leading-7 mb-3" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-2 text-slate-600" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-2 text-slate-600" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-7" {...props} />,
                  }}
                >
                  {analysis.analysis}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
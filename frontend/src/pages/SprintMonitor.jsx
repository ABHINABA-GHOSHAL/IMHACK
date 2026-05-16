import { useState, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Activity, RefreshCw, AlertTriangle, CheckCircle, TrendingDown,
  TrendingUp, Clock, MessageSquare, Loader2, Zap, ChevronDown, X,
} from "lucide-react"
import { getSprintHealth, addAIComment, generateRetrospective, getProjects, getVersions } from "../api/client"

const STATUS_COLOR = {
  "New":        "bg-slate-100 text-slate-600",
  "In Progress":"bg-blue-100 text-blue-700",
  "In Review":  "bg-amber-100 text-amber-700",
  "Closed":     "bg-emerald-100 text-emerald-700",
  "Done":       "bg-emerald-100 text-emerald-700",
  "Blocked":    "bg-red-100 text-red-700",
}

const HEALTH_CFG = {
  "On Track": { textColor: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", icon: CheckCircle,    iconColor: "#22c55e" },
  "At Risk":  { textColor: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: AlertTriangle,  iconColor: "#f59e0b" },
  "Critical": { textColor: "#991b1b", bg: "#fef2f2", border: "#fecaca", icon: AlertTriangle,  iconColor: "#ef4444" },
}

function ProgressBar({ value, color = "#6366f1" }) {
  return (
    <div className="w-full h-2 rounded-full" style={{ background: "#f1f5f9" }}>
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
    </div>
  )
}

function TicketRow({ ticket, onComment }) {
  const [busy, setBusy] = useState(false)
  const cls = STATUS_COLOR[ticket.status] || "bg-slate-100 text-slate-600"

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-4 border-b border-slate-50 last:border-0 transition-colors ${
        ticket.is_blocked ? "bg-red-50/60" : "hover:bg-slate-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {ticket.is_blocked && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
          <span className="text-sm font-semibold text-slate-700">{ticket.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>{ticket.status}</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{ticket.subject}</p>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        {ticket.assignee && <p className="text-xs text-slate-500 font-medium">{ticket.assignee}</p>}
        {ticket.due_date  && <p className="text-xs text-slate-400">{ticket.due_date}</p>}
      </div>
      {ticket.is_blocked && (
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); await onComment(ticket.id); setBusy(false) }}
          className="shrink-0 flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded-lg transition-colors"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />}
          AI Diagnose
        </button>
      )}
    </div>
  )
}

export default function SprintMonitor() {
  const [data,         setData]        = useState(null)
  const [loading,      setLoading]     = useState(true)
  const [error,        setError]       = useState("")
  const [retro,        setRetro]       = useState(null)
  const [retroOpen,    setRetroOpen]   = useState(false)
  const [retroLoading, setRetroLoad]   = useState(false)
  const [lastRefresh,  setLastRefresh] = useState(null)

  // Project + bucket selectors
  const [projects,   setProjects]   = useState([])
  const [versions,   setVersions]   = useState([])
  const [projectId,  setProjectId]  = useState("")
  const [versionId,  setVersionId]  = useState("")
  const [projectSearch, setProjectSearch] = useState("")
  const [projectsErr,   setProjectsErr]   = useState("")

  // Load projects on mount
  useEffect(() => {
    getProjects()
      .then((r) => {
        const list = r.data.projects || []
        console.log("[SprintMonitor] projects loaded:", list.length, list.map(p => p.name))
        setProjects(list)
        if (list.length) setProjectId(String(list[0].id))
        else setProjectsErr("No projects returned from OpenProject")
      })
      .catch((e) => {
        console.error("[SprintMonitor] get_projects failed:", e.message)
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
        console.log("[SprintMonitor] versions for project", projectId, ":", vlist.length, vlist.map(v => v.name))
        setVersions(vlist)
      })
      .catch((e) => {
        console.error("[SprintMonitor] get_versions failed:", e.message)
        setVersions([])
      })
  }, [projectId])

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const r = await getSprintHealth(projectId || undefined, versionId || undefined)
      setData(r.data); setLastRefresh(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [projectId, versionId])

  useEffect(() => { load() }, [load])

  const handleRetro = async () => {
    setRetroLoad(true)
    try {
      const r = await generateRetrospective(projectId || undefined, versionId || undefined)
      setRetro(r.data.retrospective)
      setRetroOpen(true)
    }
    catch (e) { setError(e.message) }
    finally { setRetroLoad(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-28">
      <Loader2 size={32} className="text-indigo-500 animate-spin" />
      <span className="ml-3 text-slate-500 text-sm">Loading sprint data…</span>
    </div>
  )

  if (error && !data) return (
    <div className="max-w-lg mx-auto mt-10">
      <div className="bg-white rounded-xl border border-red-200 p-6 text-center shadow-sm">
        <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
        <p className="text-red-700 font-semibold text-sm">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 hover:underline font-medium">Retry</button>
      </div>
    </div>
  )

  const hcfg       = HEALTH_CFG[data?.health_status] || HEALTH_CFG["On Track"]
  const HIcon      = hcfg.icon
  const healthColor = { "On Track": "#10b981", "At Risk": "#f59e0b", "Critical": "#ef4444" }[data?.health_status] || "#94a3b8"

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Live Sprint Status (KPI cards) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Activity size={12} className="text-emerald-400" />
            Live Sprint Status
          </h2>
          {data?.sprint_name && (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {data.sprint_name}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: hcfg.border }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Sprint Health</p>
                  <p className="text-[28px] font-extrabold leading-none text-slate-900">{data?.health_status ?? "N/A"}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-snug">{data?.sprint_dates?.end ? `Ends ${data.sprint_dates.end}` : "No active sprint"}</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hcfg.border}18` }}>
                  <HIcon size={20} style={{ color: hcfg.iconColor }} />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: "#10b981" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Completion</p>
                  <p className="text-[28px] font-extrabold leading-none text-slate-900">{`${data?.completion_percentage ?? 0}%`}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-snug">{`${data?.completed_tickets ?? 0}/${data?.total_tickets ?? 0} tickets closed`}</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `#10b98118` }}>
                  <TrendingUp size={20} style={{ color: "#10b981" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: (data?.blocked_tickets ?? 0) > 0 ? "#ef4444" : "#10b981" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Active Blockers</p>
                  <p className="text-[28px] font-extrabold leading-none text-slate-900">{data?.blocked_tickets ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-snug">Require immediate action</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${(data?.blocked_tickets ?? 0) > 0 ? "#ef4444" : "#10b981"}18` }}>
                  <AlertTriangle size={20} style={{ color: (data?.blocked_tickets ?? 0) > 0 ? "#ef4444" : "#10b981" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: (data?.scope_creep_percentage ?? 0) > 10 ? "#ef4444" : "#8b5cf6" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Scope Creep</p>
                  <p className="text-[28px] font-extrabold leading-none text-slate-900">{`${data?.scope_creep_percentage ?? 0}%`}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-snug">Keep additions within agreed sprint scope</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${(data?.scope_creep_percentage ?? 0) > 10 ? "#ef4444" : "#8b5cf6"}18` }}>
                  <TrendingDown size={20} style={{ color: (data?.scope_creep_percentage ?? 0) > 10 ? "#ef4444" : "#8b5cf6" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Only show project/bucket selectors and refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {projects.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Filter projects…"
                className="w-36 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder:text-slate-300"
              />
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 max-w-[220px]"
                >
                  {projects
                    .filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                    .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-[10px] text-slate-400">{projects.length} projects</span>
            </div>
          ) : projectsErr ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">Projects: {projectsErr}</span>
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Enter project ID"
                className="w-32 border border-amber-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          ) : null}
          {versions.length > 0 && (
            <div className="relative">
              <select
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
                className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="">All Buckets</option>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <p className="text-xs text-slate-400 hidden md:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-white font-bold px-4 py-2 rounded-xl shadow-sm hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
          >
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>


      {/* Live Sprint Status removed as requested */}

      {/* Tickets + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ticket Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-700">Sprint Tickets</span>
            <span className="text-xs text-slate-400 font-medium">{data?.all_tickets?.length ?? 0} total</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data?.all_tickets || []).map((t) => (
              <TicketRow key={t.id} ticket={t} onComment={addAIComment} />
            ))}
            {(!data?.all_tickets || data.all_tickets.length === 0) && (
              <div className="py-10 text-center text-sm text-slate-400">No tickets found</div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Actions - extensible */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Sprint Actions</p>
            <div className="space-y-2">
              <button
                onClick={handleRetro}
                disabled={retroLoading}
                className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
              >
                {retroLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {retroLoading ? "Generating…" : "Auto-Draft Retrospective"}
              </button>
            </div>
          </div>

          {/* Blockers */}
          {data?.blockers?.length > 0 && (
            <div
              className="rounded-xl border p-4"
              style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
            >
              <p className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle size={13} />Blockers ({data.blockers.length})
              </p>
              <div className="space-y-2">
                {data.blockers.map((b) => (
                  <div key={b.id} className="text-xs">
                    <p className="font-bold text-red-700">{b.id}: {b.subject}</p>
                    {b.blocking?.length > 0 && (
                      <p className="text-red-500 mt-0.5">Blocking: {b.blocking.join(", ")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clock */}
          <div
            className="rounded-xl border p-4 text-center"
            style={{ background: "linear-gradient(135deg,#f8fafc,#f1f5f9)", border: "1px solid #e2e8f0" }}
          >
            <Clock size={20} className="text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs text-slate-500 font-medium">Last Refreshed</p>
            <p className="text-sm font-bold text-slate-700 mt-0.5">
              {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
            </p>
          </div>
        </div>
      </div>

      {retroOpen && retro && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-stretch justify-center p-3 sm:p-6">
          <div className="w-full h-full max-w-7xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-indigo-50">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Auto-Generated Retrospective</p>
                <p className="text-sm text-slate-500 mt-1">
                  {projects.find((p) => String(p.id) === String(projectId))?.name || "Selected project"}
                  {versionId ? ` · ${versions.find((v) => String(v.id) === String(versionId))?.name || "Selected bucket"}` : " · All buckets"}
                </p>
              </div>
              <button
                onClick={() => setRetroOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
                title="Close retrospective"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 bg-slate-50">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8 max-w-5xl mx-auto markdown-content">
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
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-extrabold text-slate-900 mb-4" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3" {...props} />,
                    p: ({ node, ...props }) => <p className="text-slate-600 leading-7 mb-3" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-2 text-slate-600" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-2 text-slate-600" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-7" {...props} />,
                  }}
                >
                  {retro}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

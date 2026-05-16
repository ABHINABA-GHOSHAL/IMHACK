import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  FileText, Activity, BarChart3, TrendingUp, AlertTriangle,
  ArrowRight, Zap, Database, Target, Bug, CheckCircle2,
  ChevronDown, Loader2, Circle, Search,
} from "lucide-react"
import { getQuickSummary, getProjects, getVersions, getTicketStats } from "../api/client"

const ACTIONS = [
  { to: "/documents", label: "Generate BRD",  desc: "", icon: FileText,  color: "#6366f1" },
  { to: "/sprint",    label: "Sprint Health", desc: "Live sprint monitoring & alerts",    icon: Activity,  color: "#10b981" },
  { to: "/analysis",  label: "Ticket Analysis", desc: "Inspect one ticket in detail",     icon: Search,    color: "#f97316" },
  { to: "/reports",   label: "Status Report", desc: "Auto-generate weekly status report", icon: BarChart3, color: "#8b5cf6" },
]

function KpiCard({ label, value, sub, color, icon: Icon, loading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="h-[3px]" style={{ background: color }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
            {loading ? (
              <div className="h-8 w-24 shimmer" />
            ) : (
              <p className="text-[28px] font-extrabold leading-none text-slate-900">{value ?? "—"}</p>
            )}
            <p className="text-xs text-slate-400 mt-2 leading-snug">{sub}</p>
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}18` }}
          >
            <Icon size={20} style={{ color }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sprintData, setSprintData] = useState(null)
  const [loading, setLoading]       = useState(true)

  // Ticket stats state
  const [statsProjects,   setStatsProjects]   = useState([])
  const [statsProjectId,  setStatsProjectId]  = useState("")
  const [statsVersions,   setStatsVersions]   = useState([])
  const [statsVersionId,  setStatsVersionId]  = useState("")
  const [ticketStats,     setTicketStats]     = useState(null)
  const [statsLoading,    setStatsLoading]    = useState(false)
  const [showBugList,     setShowBugList]     = useState(false)

  useEffect(() => {
    Promise.allSettled([getQuickSummary()])
      .then(([sprint]) => {
        if (sprint.status === "fulfilled") setSprintData(sprint.value.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Load projects for stats dropdown
  useEffect(() => {
    getProjects()
      .then((r) => {
        const list = r.data.projects || []
        setStatsProjects(list)
        if (list.length) setStatsProjectId(String(list[0].id))
      })
      .catch(() => {})
  }, [])

  // Load versions when stats project changes
  useEffect(() => {
    if (!statsProjectId) return
    setStatsVersionId("")
    setTicketStats(null)
    setShowBugList(false)
    getVersions(statsProjectId)
      .then((r) => setStatsVersions(r.data.versions || []))
      .catch(() => setStatsVersions([]))
  }, [statsProjectId])

  // Auto-fetch stats when project changes
  useEffect(() => {
    if (!statsProjectId) return
    fetchStats()
  }, [statsProjectId, statsVersionId])

  const fetchStats = async () => {
    if (!statsProjectId) return
    setStatsLoading(true)
    setShowBugList(false)
    try {
      const r = await getTicketStats(statsProjectId, statsVersionId || undefined)
      setTicketStats(r.data)
    } catch (_) {
      setTicketStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  const healthColor =
    { "On Track": "#10b981", "At Risk": "#f59e0b", "Critical": "#ef4444" }[
      sprintData?.health_status
    ] || "#94a3b8"

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-2xl text-white"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #6d28d9 100%)" }}
      >
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.04)" }} />
        <div className="absolute -bottom-10 left-32 w-56 h-56 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.03)" }} />

        <div className="relative flex flex-col lg:flex-row items-start gap-6 px-7 py-7">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl lg:text-[28px] font-extrabold leading-snug mb-2.5">
              IM-InsightOps
            </h1>
            <p className="text-sm text-indigo-200 leading-relaxed max-w-lg">
              AI-powered project operations workspace for BRD generation, sprint
              monitoring, ticket analysis, and status reporting in one place.
            </p>

          </div>
        </div>
      </div>

      {/* Live Sprint Status section removed as requested */}

      {/* ── Ticket Category Stats ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <BarChart3 size={12} className="text-indigo-400" />
            Ticket Overview by Category
          </h2>
          <div className="flex items-center gap-2">
            {/* Project selector */}
            {statsProjects.length > 0 && (
              <div className="relative">
                <select
                  value={statsProjectId}
                  onChange={(e) => setStatsProjectId(e.target.value)}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[180px]"
                >
                  {statsProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
            {/* Version selector */}
            {statsVersions.length > 0 && (
              <div className="relative">
                <select
                  value={statsVersionId}
                  onChange={(e) => setStatsVersionId(e.target.value)}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">All Sprints</option>
                  {statsVersions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Open Tickets */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: "#6366f1" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Open Tickets</p>
                  {statsLoading ? <div className="h-8 w-16 shimmer" /> : (
                    <p className="text-[28px] font-extrabold leading-none text-slate-900">{ticketStats?.open ?? "—"}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">Active in progress</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#6366f118" }}>
                  <Circle size={20} style={{ color: "#6366f1" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Closed Tickets */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: "#10b981" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Closed Tickets</p>
                  {statsLoading ? <div className="h-8 w-16 shimmer" /> : (
                    <p className="text-[28px] font-extrabold leading-none text-slate-900">{ticketStats?.closed ?? "—"}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">Done / resolved</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#10b98118" }}>
                  <CheckCircle2 size={20} style={{ color: "#10b981" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bug Tickets Open — clickable */}
          <div
            className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            onClick={() => ticketStats && setShowBugList((v) => !v)}
            title="Click to see open bug tickets"
          >
            <div className="h-[3px]" style={{ background: "#ef4444" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bugs Open</p>
                  {statsLoading ? <div className="h-8 w-16 shimmer" /> : (
                    <p className="text-[28px] font-extrabold leading-none text-red-600">{ticketStats?.bugs_open ?? "—"}</p>
                  )}
                  <p className="text-xs text-red-400 mt-2 group-hover:underline">Click to view list</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#ef444418" }}>
                  <Bug size={20} style={{ color: "#ef4444" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bug Tickets Closed */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: "#f59e0b" }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bugs Closed</p>
                  {statsLoading ? <div className="h-8 w-16 shimmer" /> : (
                    <p className="text-[28px] font-extrabold leading-none text-slate-900">{ticketStats?.bugs_closed ?? "—"}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">Fixed &amp; resolved</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#f59e0b18" }}>
                  <Bug size={20} style={{ color: "#f59e0b" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bug ticket list (expandable) */}
        {showBugList && ticketStats?.bug_tickets_open?.length > 0 && (
          <div className="mt-3 bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
            <div
              className="flex items-center gap-2 px-5 py-3 border-b border-red-100"
              style={{ background: "linear-gradient(135deg,#fff1f2,#ffe4e6)" }}
            >
              <Bug size={14} className="text-red-500" />
              <span className="font-bold text-red-700 text-sm">
                {ticketStats.bug_tickets_open.length} Open Bug Ticket{ticketStats.bug_tickets_open.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {ticketStats.bug_tickets_open.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="text-[10px] font-bold text-red-400 mt-0.5 shrink-0">{t.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 leading-snug truncate">{t.subject}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                        {t.type_name || "Bug"}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t.status}</span>
                      {t.assignee && (
                        <span className="text-[10px] text-indigo-600 font-semibold">{t.assignee}</span>
                      )}
                      {t.due_date && (
                        <span className="text-[10px] text-slate-400">Due {t.due_date}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showBugList && ticketStats?.bugs_open === 0 && (
          <div className="mt-3 rounded-xl border border-green-100 px-5 py-4 text-sm text-green-700 font-medium" style={{ background: "#f0fdf4" }}>
            No open bug tickets — all clear!
          </div>
        )}
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
          <Zap size={12} className="text-indigo-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ACTIONS.map(({ to, label, desc, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className="group bg-white rounded-xl border border-slate-200/70 shadow-sm p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 block"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${color}16`, border: `1px solid ${color}22` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{label}</p>
              {desc ? <p className="text-xs text-slate-400 mt-1 mb-3 leading-snug">{desc}</p> : <div className="h-3" />}
              <span
                className="inline-flex items-center gap-1 text-xs font-bold group-hover:gap-1.5 transition-all"
                style={{ color }}
              >
                Open{" "}
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}

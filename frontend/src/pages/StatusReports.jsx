import { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { jsPDF } from "jspdf"
import { BarChart3, Loader2, AlertTriangle, CheckCircle, Download, RefreshCw, Zap, ChevronDown } from "lucide-react"
import { generateStatusReport, getProjects, getVersions } from "../api/client"

const HEALTH_STYLE = {
  "On Track": { bg: "#ecfeff", border: "#a5f3fc", color: "#0f766e" },
  "At Risk":  { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
  "Critical": { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
}

export default function StatusReports() {
  const [report, setReport]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState("")
  const [projectId, setProjectId]   = useState("")
  const [withHistory, setHistory]   = useState(true)
  const [projects, setProjects]     = useState([])
  const [projectSearch, setSearch]  = useState("")
  const [versions, setVersions]     = useState([])
  const [versionId, setVersionId]   = useState("")
  const reportPdfRef = useRef(null)

  useEffect(() => {
    getProjects()
      .then((r) => {
        const list = r.data.projects || []
        console.log("[StatusReports] projects loaded:", list.length)
        setProjects(list)
      })
      .catch((e) => console.error("[StatusReports] get_projects failed:", e.message))
  }, [])

  // Load sprints/versions when project changes
  useEffect(() => {
    if (!projectId) { setVersions([]); setVersionId(""); return }
    getVersions(projectId)
      .then((r) => {
        const vlist = r.data.versions || []
        console.log("[StatusReports] versions for project", projectId, ":", vlist.length, vlist.map(v => v.name))
        setVersions(vlist)
        setVersionId("")
      })
      .catch(() => setVersions([]))
  }, [projectId])

  const generate = async () => {
    setLoading(true); setError(""); setReport(null)
    try {
      const r = await generateStatusReport({ project_id: projectId || undefined, version_id: versionId || undefined, include_history: withHistory })
      setReport(r.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const download = () => {
    if (!report) return
    const blob = new Blob([report.full_report], { type: "text/markdown" })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement("a"), {
      href: url,
      download: `Status_Report_${(report.sprint_name || "report").replace(/\s+/g, "_")}.md`,
    })
    a.click(); URL.revokeObjectURL(url)
  }

  const downloadPdf = async () => {
    if (!report?.full_report) return
    const renderedNode = reportPdfRef.current
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
    title.textContent = `Status Report - ${report.sprint_name || "Current Sprint"}`

    const meta = document.createElement("p")
    meta.style.margin = "0 0 20px"
    meta.style.color = "#64748b"
    meta.style.fontSize = "12px"
    meta.textContent = `Generated ${report.generated_at ? new Date(report.generated_at).toLocaleString() : new Date().toLocaleString()}`

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
      pdf.save(`Status_Report_${(report.sprint_name || "report").replace(/\s+/g, "_")}.pdf`)
    } finally {
      document.body.removeChild(container)
    }
  }

  const hs = HEALTH_STYLE[report?.health_status] || HEALTH_STYLE["On Track"]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl border px-5 py-5" style={{ background: "linear-gradient(140deg,#f0fdfa,#ecfeff)", borderColor: "#a5f3fc" }}>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#14b8a6,#0f766e)" }}
          >
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Status Report Studio</h1>
            <p className="text-sm text-slate-600">
              Build a leadership-ready weekly brief from live sprint data and AI synthesis
            </p>
          </div>
        </div>
        <p className="text-xs text-teal-700/80 pl-14">Designed for distribution: concise health, risks, completion, and narrative context in one markdown artifact.</p>
      </div>

      {/* Generation Panel */}
      <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Generate Report</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Project <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            {projects.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={projectSearch}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter…"
                  className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-300 placeholder:text-slate-300"
                />
                <div className="relative">
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300 max-w-[220px]"
                  >
                    <option value="">— All projects —</option>
                    {projects
                      .filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                      .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                    }
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <span className="text-[10px] text-slate-400">{projects.length} projects</span>
              </div>
            ) : (
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Leave blank for default"
                className="w-52 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-700"
              />
            )}
          </div>

          {/* Sprint / Version selector */}
          {versions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Sprint <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <select
                  value={versionId}
                  onChange={(e) => setVersionId(e.target.value)}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300 max-w-[220px]"
                >
                  <option value="">— All Sprints —</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 pb-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={withHistory}
              onChange={(e) => setHistory(e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded"
            />
            <span className="text-sm text-slate-600 select-none">Include historical comparison</span>
          </label>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
            style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? "Generating Report…" : "Generate Now"}
          </button>
        </div>

      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-14 flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-teal-500 animate-spin" />
          <p className="text-sm text-slate-500">Pulling sprint data and generating report with RAG context…</p>
          <p className="text-xs text-slate-400">This typically takes 15–30 seconds</p>
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Sprint */}
            <div
              className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden p-4"
              style={{ borderTop: "3px solid #0f766e" }}
            >
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sprint</p>
              <p className="text-base font-extrabold text-slate-800 mt-1 leading-tight">{report.sprint_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{report.week_of}</p>
            </div>

            {/* Health */}
            <div
              className="rounded-xl border shadow-sm p-4"
              style={{ background: hs.bg, borderColor: hs.border, borderTopWidth: "3px", borderTopStyle: "solid" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-60" style={{ color: hs.color }}>Health</p>
              <p className="text-base font-extrabold mt-1" style={{ color: hs.color }}>{report.health_status}</p>
            </div>

            {/* Completion */}
            <div
              className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden p-4"
              style={{ borderTop: "3px solid #ea580c" }}
            >
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completion</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1 leading-none">{report.completion_percentage}%</p>
            </div>

            {/* Blockers */}
            <div
              className="rounded-xl border shadow-sm p-4"
              style={
                report.blocked_tickets > 0
                  ? { background: "#fef2f2", borderColor: "#fecaca", borderTopWidth: "3px", borderTopStyle: "solid", borderTopColor: "#ef4444" }
                  : { background: "#fff", borderColor: "#e2e8f0", borderTopWidth: "3px", borderTopStyle: "solid", borderTopColor: "#10b981" }
              }
            >
              <p className={`text-[11px] font-bold uppercase tracking-wider ${report.blocked_tickets > 0 ? "text-red-400" : "text-slate-400"}`}>
                Blockers
              </p>
              <p className={`text-3xl font-extrabold mt-1 leading-none ${report.blocked_tickets > 0 ? "text-red-700" : "text-slate-800"}`}>
                {report.blocked_tickets}
              </p>
            </div>
          </div>

          {/* Person-wise Action Plan */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700 text-sm">Person-wise Action Plan</p>
                <p className="text-xs text-slate-400">Clear ownership, risk, and next steps per assignee</p>
              </div>
            </div>
            {Array.isArray(report.assignee_analysis) && report.assignee_analysis.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Person</th>
                      <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Open</th>
                      <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Blocked</th>
                      <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Risk</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">What They Should Do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.assignee_analysis.map((row, idx) => {
                      const risk = row.risk_level || "Low"
                      const riskCls =
                        risk === "High"
                          ? "bg-red-100 text-red-700"
                          : risk === "Medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      const actions = Array.isArray(row.next_actions) ? row.next_actions.filter(Boolean).join(" ") : ""
                      return (
                        <tr key={`${row.assignee}-${idx}`} className="border-t border-slate-100 align-top">
                          <td className="px-4 py-3 font-semibold text-slate-700">{row.assignee || "Unassigned"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{row.open_tickets ?? 0}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{row.blocked_tickets ?? 0}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{row.overdue_tickets ?? 0}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${riskCls}`}>{risk}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[520px]">{actions || "No immediate action required."}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-slate-500">No assignee analysis available for this report.</div>
            )}
          </div>

          {/* Full Report */}
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-500" />
                <span className="font-bold text-slate-700 text-sm">Full Status Report</span>
                <span className="text-xs text-slate-400 hidden sm:block">
                  Generated {new Date(report.generated_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generate}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 transition-colors"
                >
                  <RefreshCw size={12} />Regenerate
                </button>
                <button
                  onClick={downloadPdf}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}
                >
                  <Download size={12} />Download PDF
                </button>
                <button
                  onClick={download}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}
                >
                  <Download size={12} />Download MD
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto">
              <div ref={reportPdfRef} className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.full_report}</ReactMarkdown>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty */}
      {!report && !loading && (
        <div
          className="bg-white rounded-xl border-2 border-dashed p-16 flex flex-col items-center gap-3 text-center"
          style={{ borderColor: "#e2e8f0" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#ecfeff,#ccfbf1)" }}
          >
            <BarChart3 size={22} className="text-teal-600" />
          </div>
          <p className="text-sm font-medium text-slate-600">Generate your weekly leadership brief from current sprint telemetry</p>
          <p className="text-xs text-slate-400">Pulls live data from OpenProject + RAG historical comparison + AI analysis</p>
        </div>
      )}
    </div>
  )
}

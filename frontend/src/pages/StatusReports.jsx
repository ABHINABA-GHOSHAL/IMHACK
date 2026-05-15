import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { BarChart3, Loader2, AlertTriangle, CheckCircle, Download, RefreshCw, Zap } from 'lucide-react'
import { generateStatusReport } from '../api/client'

const HEALTH_COLORS = {
  'On Track': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'At Risk': 'text-amber-700 bg-amber-50 border-amber-200',
  'Critical': 'text-red-700 bg-red-50 border-red-200',
}

export default function StatusReports() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [projectId, setProjectId] = useState('')
  const [includeHistory, setIncludeHistory] = useState(true)

  const generate = async () => {
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const res = await generateStatusReport({
        project_id: projectId || undefined,
        include_history: includeHistory,
      })
      setReport(res.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    if (!report) return
    const blob = new Blob([report.full_report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Status_Report_${report.sprint_name?.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <BarChart3 size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Automatic Status Reports</h1>
          <p className="text-sm text-slate-500">AI-generated sprint status report in seconds — RAG-grounded, data-driven</p>
        </div>
      </div>

      {/* Generation Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-700 mb-4 text-sm">Generate Status Report</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project ID (optional)</label>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Leave blank for default"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <input
              id="history"
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <label htmlFor="history" className="text-sm text-slate-600">Include historical comparison</label>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'Generating Report...' : 'Generate Now'}
          </button>
        </div>

        {/* Context */}
        <div className="mt-4 p-3 bg-violet-50 rounded-lg">
          <p className="text-xs text-violet-700">
            <strong>What this generates:</strong> Live sprint metrics from OpenProject + RAG-retrieved historical comparisons + AI analysis of blockers and scope creep + completion prediction → Full Markdown status report ready to send.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-violet-500 animate-spin" />
          <p className="text-slate-500 text-sm">Pulling sprint data and generating report with RAG context...</p>
          <p className="text-slate-400 text-xs">This typically takes 15-30 seconds</p>
        </div>
      )}

      {report && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Sprint</p>
              <p className="text-base font-bold text-slate-800 mt-1">{report.sprint_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{report.week_of}</p>
            </div>
            <div className={`rounded-xl border p-4 ${HEALTH_COLORS[report.health_status] || 'bg-white border-slate-200'}`}>
              <p className="text-xs font-medium opacity-70">Health</p>
              <p className="text-base font-bold mt-1">{report.health_status}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Completion</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{report.completion_percentage}%</p>
            </div>
            <div className={`rounded-xl border p-4 ${report.blocked_tickets > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
              <p className={`text-xs font-medium ${report.blocked_tickets > 0 ? 'text-red-500' : 'text-slate-500'}`}>Blockers</p>
              <p className={`text-2xl font-bold mt-1 ${report.blocked_tickets > 0 ? 'text-red-700' : 'text-slate-800'}`}>{report.blocked_tickets}</p>
            </div>
          </div>

          {/* Full Report */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                <h3 className="font-semibold text-slate-700 text-sm">Full Status Report</h3>
                <span className="text-xs text-slate-400">Generated {new Date(report.generated_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={generate} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                  <RefreshCw size={12} />Regenerate
                </button>
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium"
                >
                  <Download size={12} />Download
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto">
              <div className="markdown-content">
                <ReactMarkdown>{report.full_report}</ReactMarkdown>
              </div>
            </div>
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 flex flex-col items-center gap-3 text-center">
          <BarChart3 size={40} className="text-slate-300" />
          <p className="text-slate-400 text-sm">Click "Generate Now" to create this week's status report</p>
          <p className="text-slate-300 text-xs">Pulls live data from OpenProject + RAG historical comparison + AI analysis</p>
        </div>
      )}
    </div>
  )
}

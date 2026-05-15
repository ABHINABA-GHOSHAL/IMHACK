import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Activity, RefreshCw, AlertTriangle, CheckCircle, TrendingDown,
  TrendingUp, Clock, MessageSquare, Loader2, ChevronRight, Zap
} from 'lucide-react'
import { getSprintHealth, addAIComment, generateRetrospective } from '../api/client'

const STATUS_COLORS = {
  'New': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'In Review': 'bg-amber-100 text-amber-700',
  'Closed': 'bg-emerald-100 text-emerald-700',
  'Done': 'bg-emerald-100 text-emerald-700',
  'Blocked': 'bg-red-100 text-red-700',
}

const HEALTH_CONFIG = {
  'On Track': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-500' },
  'At Risk': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500' },
  'Critical': { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertTriangle, iconColor: 'text-red-500' },
}

function ProgressBar({ value, color = 'bg-indigo-500' }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

function TicketRow({ ticket, onComment }) {
  const [commenting, setCommenting] = useState(false)
  const statusClass = STATUS_COLORS[ticket.status] || 'bg-slate-100 text-slate-600'

  const handleComment = async () => {
    setCommenting(true)
    await onComment(ticket.id)
    setCommenting(false)
  }

  return (
    <div className={`flex items-center gap-3 py-2.5 px-4 border-b border-slate-100 last:border-0 ${ticket.is_blocked ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {ticket.is_blocked && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
          <span className="text-sm font-medium text-slate-700 truncate">{ticket.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>{ticket.status}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{ticket.subject}</p>
      </div>
      <div className="text-right shrink-0">
        {ticket.assignee && <p className="text-xs text-slate-500">{ticket.assignee}</p>}
        {ticket.due_date && <p className="text-xs text-slate-400">{ticket.due_date}</p>}
      </div>
      {ticket.is_blocked && (
        <button
          onClick={handleComment}
          disabled={commenting}
          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0"
        >
          {commenting ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />}
          AI Diagnose
        </button>
      )}
    </div>
  )
}

export default function SprintMonitor() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retro, setRetro] = useState(null)
  const [retroLoading, setRetroLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSprintHealth()
      setData(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleComment = async (ticketId) => {
    await addAIComment(ticketId)
  }

  const handleRetrospective = async () => {
    setRetroLoading(true)
    try {
      const res = await generateRetrospective()
      setRetro(res.data.retrospective)
    } catch (e) {
      setError(e.message)
    } finally {
      setRetroLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500">Loading sprint data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={load} className="mt-3 text-sm text-red-600 hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  const health = data ? HEALTH_CONFIG[data.health_status] || HEALTH_CONFIG['On Track'] : HEALTH_CONFIG['On Track']
  const HealthIcon = health.icon

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Activity size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Sprint Health Monitor</h1>
            <p className="text-sm text-slate-500">
              {data?.sprint_name} &bull; {data?.sprint_dates?.start} → {data?.sprint_dates?.end}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && <p className="text-xs text-slate-400 hidden sm:block">Last updated {lastRefresh.toLocaleTimeString()}</p>}
          <button onClick={load} className="flex items-center gap-1.5 text-sm bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg font-medium text-slate-600">
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      {/* Health Banner */}
      <div className={`border rounded-xl p-4 ${health.bg}`}>
        <div className="flex items-center gap-3">
          <HealthIcon size={20} className={health.iconColor} />
          <div>
            <p className={`font-semibold ${health.color}`}>{data?.health_status}</p>
            {data?.ai_summary && <p className="text-sm text-slate-600 mt-0.5">{data.ai_summary}</p>}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Completion', value: `${data?.completion_percentage ?? 0}%`, sub: `${data?.completed_tickets}/${data?.total_tickets} tickets`, icon: TrendingUp, color: 'emerald' },
          { label: 'Blocked', value: data?.blocked_tickets ?? 0, sub: 'Require escalation', icon: AlertTriangle, color: data?.blocked_tickets > 0 ? 'red' : 'slate' },
          { label: 'Scope Creep', value: `${data?.scope_creep_percentage ?? 0}%`, sub: 'vs sprint baseline', icon: TrendingDown, color: data?.scope_creep_percentage > 10 ? 'amber' : 'slate' },
          { label: 'Velocity Ratio', value: `${data?.velocity_vs_average ?? 0}%`, sub: 'vs 5-sprint avg', icon: Zap, color: data?.velocity_vs_average < 70 ? 'red' : 'emerald' },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-slate-700">Sprint Progress</span>
          <span className="text-slate-500">{data?.completed_story_points ?? 0} / {data?.total_story_points ?? 0} story points</span>
        </div>
        <ProgressBar
          value={data?.completion_percentage ?? 0}
          color={data?.health_status === 'On Track' ? 'bg-emerald-500' : data?.health_status === 'At Risk' ? 'bg-amber-500' : 'bg-red-500'}
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>Sprint Start</span>
          <span>Historical avg: {data?.sprint_dates?.start ? '85%' : 'N/A'}</span>
          <span>Sprint End</span>
        </div>
      </div>

      {/* Alerts */}
      {data?.alerts?.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tickets + Retrospective */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 text-sm">Sprint Tickets</h3>
            <span className="text-xs text-slate-400">{data?.all_tickets?.length ?? 0} total</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data?.all_tickets?.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} onComment={handleComment} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Sprint Actions</h3>
            <button
              onClick={handleRetrospective}
              disabled={retroLoading}
              className="w-full flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              {retroLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {retroLoading ? 'Generating...' : 'Auto-Draft Retrospective'}
            </button>
          </div>

          {/* Blockers detail */}
          {data?.blockers?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-700 text-sm mb-2 flex items-center gap-2">
                <AlertTriangle size={14} />Blockers ({data.blockers.length})
              </h3>
              <div className="space-y-2">
                {data.blockers.map((b) => (
                  <div key={b.id} className="text-xs">
                    <p className="font-medium text-red-700">{b.id}: {b.subject}</p>
                    {b.blocking?.length > 0 && (
                      <p className="text-red-500 mt-0.5">
                        Blocking: {b.blocking.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Retrospective output */}
      {retro && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <Zap size={16} className="text-violet-500" />
            <h3 className="font-semibold text-slate-700 text-sm">Auto-Generated Retrospective</h3>
          </div>
          <div className="p-5 max-h-[400px] overflow-y-auto">
            <div className="markdown-content">
              <ReactMarkdown>{retro}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

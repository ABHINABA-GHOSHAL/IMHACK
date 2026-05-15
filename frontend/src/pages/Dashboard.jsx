import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Activity, Bell, BarChart3, TrendingUp, AlertTriangle, CheckCircle, Clock, ArrowRight, Zap } from 'lucide-react'
import { getQuickSummary, getKBStats, getReminderStats } from '../api/client'

const metrics = [
  { label: 'BRD Creation', before: '2-3 hours', after: '15 minutes', saving: '92%', color: 'indigo' },
  { label: 'Weekly Status Report', before: '2 hours', after: '2 minutes', saving: '98%', color: 'emerald' },
  { label: 'Blocker Detection', before: 'Day 3-4', after: 'Day 1', saving: 'Early', color: 'amber' },
  { label: 'Retrospective', before: '1-2 hours', after: '10 minutes', saving: '89%', color: 'violet' },
]

const quickLinks = [
  { to: '/documents', label: 'Generate BRD', desc: 'Answer 6 questions → complete BRD', icon: FileText, color: 'bg-indigo-500' },
  { to: '/sprint', label: 'Sprint Health', desc: 'Real-time sprint monitoring', icon: Activity, color: 'bg-emerald-500' },
  { to: '/reminders', label: 'Reminders', desc: 'AI-powered assignee reminders', icon: Bell, color: 'bg-amber-500' },
  { to: '/reports', label: 'Status Report', desc: 'Auto-generate weekly report', icon: BarChart3, color: 'bg-violet-500' },
]

function StatCard({ label, value, sub, color = 'indigo', icon: Icon }) {
  const colors = {
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    violet: 'text-violet-600 bg-violet-50',
    red: 'text-red-600 bg-red-50',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sprintData, setSprintData] = useState(null)
  const [kbStats, setKbStats] = useState(null)
  const [reminderStats, setReminderStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([getQuickSummary(), getKBStats(), getReminderStats()])
      .then(([sprint, kb, rem]) => {
        if (sprint.status === 'fulfilled') setSprintData(sprint.value.data)
        if (kb.status === 'fulfilled') setKbStats(kb.value.data)
        if (rem.status === 'fulfilled') setReminderStats(rem.value.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const healthColor = {
    'On Track': 'emerald',
    'At Risk': 'amber',
    'Critical': 'red',
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={20} />
          <span className="text-sm font-medium text-indigo-200">IndiaMart 10X Productivity AI</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">Project Intelligence & Documentation Copilot</h1>
        <p className="text-indigo-200 text-sm max-w-2xl">
          Eliminate 8-12 hours/week of documentation overhead. AI-powered BRD generation, sprint monitoring,
          intelligent reminders, and auto-generated status reports — all grounded in your institutional memory.
        </p>
      </div>

      {/* Live Sprint Stats */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Activity size={16} className="text-indigo-500" />
          Live Sprint Status
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Sprint Health"
            value={loading ? '...' : (sprintData?.health_status || 'N/A')}
            sub={loading ? '' : sprintData?.sprint_name}
            color={loading ? 'indigo' : (healthColor[sprintData?.health_status] || 'indigo')}
            icon={Activity}
          />
          <StatCard
            label="Completion"
            value={loading ? '...' : `${sprintData?.completion_percentage || 0}%`}
            sub="Story points done"
            color="emerald"
            icon={TrendingUp}
          />
          <StatCard
            label="Active Blockers"
            value={loading ? '...' : (sprintData?.blocked_tickets ?? '0')}
            sub="Require immediate action"
            color={sprintData?.blocked_tickets > 0 ? 'red' : 'emerald'}
            icon={AlertTriangle}
          />
          <StatCard
            label="Pending Reminders"
            value={loading ? '...' : (reminderStats?.pending ?? '0')}
            sub={`${reminderStats?.total_sent ?? 0} total sent`}
            color="amber"
            icon={Bell}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Zap size={16} className="text-indigo-500" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map(({ to, label, desc, icon: Icon, color }) => (
            <Link key={to} to={to}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">{desc}</p>
              <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium group-hover:gap-2 transition-all">
                Open <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-500" />
            RAG Knowledge Base
          </h3>
          <p className="text-sm text-slate-500 mb-4">Institutional memory powering all AI generations</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Total Documents</span>
              <span className="font-bold text-indigo-600">{kbStats?.total_documents ?? '...'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Embedding Model</span>
              <span className="text-xs font-medium text-slate-500">{kbStats?.embedding_model ?? 'all-MiniLM-L6-v2'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-600">Retrieval Strategy</span>
              <span className="text-xs font-medium text-slate-500">Dense + Semantic</span>
            </div>
          </div>
        </div>

        {/* Time Savings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Clock size={16} className="text-violet-500" />
            Time Savings vs Manual
          </h3>
          <p className="text-sm text-slate-500 mb-4">Impact on weekly PM overhead (8-12 hrs → &lt;1 hr)</p>
          <div className="space-y-3">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-600 w-36 shrink-0">{m.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-red-400 line-through w-16 text-right">{m.before}</span>
                  <ArrowRight size={10} className="text-slate-300 shrink-0" />
                  <span className="text-xs text-emerald-600 font-medium">{m.after}</span>
                </div>
                <span className="text-xs font-bold text-indigo-600 w-10 text-right">{m.saving}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

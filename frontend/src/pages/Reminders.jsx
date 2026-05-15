import { useState, useEffect } from 'react'
import { Bell, RefreshCw, Zap, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { getReminders, evaluateReminders, acknowledgeReminder, getReminderStats } from '../api/client'

const TYPE_CONFIG = {
  due_2_days: { label: '2-Day Warning', color: 'bg-amber-100 text-amber-700', icon: Clock },
  due_today: { label: 'Due Today', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  blocker: { label: 'Blocker', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  stale: { label: 'Stale Ticket', color: 'bg-slate-100 text-slate-600', icon: Clock },
  assignment: { label: 'Assignment', color: 'bg-blue-100 text-blue-700', icon: Bell },
  sprint_risk: { label: 'Sprint Risk', color: 'bg-violet-100 text-violet-700', icon: AlertTriangle },
}

function ReminderCard({ reminder, onAcknowledge }) {
  const config = TYPE_CONFIG[reminder.reminder_type] || { label: reminder.reminder_type, color: 'bg-slate-100 text-slate-600', icon: Bell }
  const Icon = config.icon
  const [acking, setAcking] = useState(false)

  const handleAck = async () => {
    setAcking(true)
    await onAcknowledge(reminder.id)
    setAcking(false)
  }

  return (
    <div className={`bg-white rounded-xl border p-4 transition-opacity ${reminder.acknowledged ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-indigo-200'}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={14} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>{config.label}</span>
            <span className="text-xs font-mono text-slate-500">{reminder.ticket_id}</span>
            <span className="text-xs text-slate-400">→ {reminder.assignee_name}</span>
          </div>
          <p className="text-xs font-medium text-slate-600 mb-1 truncate">{reminder.ticket_subject}</p>
          <p className="text-sm text-slate-700 leading-relaxed">{reminder.message}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">
              {reminder.sent_at ? new Date(reminder.sent_at).toLocaleString() : ''}
            </span>
            {!reminder.acknowledged ? (
              <button
                onClick={handleAck}
                disabled={acking}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {acking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Acknowledge
              </button>
            ) : (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <CheckCircle size={12} className="text-emerald-400" />Acknowledged
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      const [remRes, statRes] = await Promise.all([getReminders(), getReminderStats()])
      setReminders(remRes.data.reminders)
      setStats(statRes.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleEvaluate = async () => {
    setEvaluating(true)
    setError('')
    try {
      const res = await evaluateReminders()
      await loadData()
      if (res.data.generated === 0) {
        setError('No new reminders needed at this time.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setEvaluating(false)
    }
  }

  const handleAcknowledge = async (id) => {
    await acknowledgeReminder(id)
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, acknowledged: true } : r))
    setStats((prev) => prev ? { ...prev, acknowledged: (prev.acknowledged || 0) + 1, pending: Math.max(0, (prev.pending || 0) - 1) } : prev)
  }

  const filtered = reminders.filter((r) => {
    if (filter === 'pending') return !r.acknowledged
    if (filter === 'acknowledged') return r.acknowledged
    return true
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Bell size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Reminder Engine</h1>
            <p className="text-sm text-slate-500">AI-generated contextual reminders for every assignee</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="flex items-center gap-1.5 text-sm bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg font-medium text-slate-600">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {evaluating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {evaluating ? 'Evaluating...' : 'Evaluate & Generate'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{stats.total_sent ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Sent</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Pending</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.acknowledged ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Acknowledged</p>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-indigo-800 mb-2">How the Reminder Engine Works</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { step: '1', label: 'Pull tickets', desc: 'Fetch all open tickets from OpenProject every 30 min' },
            { step: '2', label: 'Evaluate rules', desc: 'Check 5 reminder conditions per ticket' },
            { step: '3', label: 'Deduplicate', desc: 'No duplicate sends within 24 hours' },
            { step: '4', label: 'AI message', desc: 'Generate contextual, personalized reminder' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="bg-white rounded-lg p-3">
              <div className="w-5 h-5 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center font-bold mb-1.5">{step}</div>
              <p className="text-xs font-semibold text-slate-700">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {['all', 'pending', 'acknowledged'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}
          >
            {f} {f === 'all' ? `(${reminders.length})` : f === 'pending' ? `(${reminders.filter(r => !r.acknowledged).length})` : `(${reminders.filter(r => r.acknowledged).length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">{error}</div>
      )}

      {/* Reminders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="text-indigo-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Bell size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {filter === 'pending' ? 'No pending reminders.' : 'No reminders yet.'}
          </p>
          <p className="text-slate-300 text-xs mt-1">Click "Evaluate & Generate" to check for new reminders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReminderCard key={r.id} reminder={r} onAcknowledge={handleAcknowledge} />
          ))}
        </div>
      )}
    </div>
  )
}

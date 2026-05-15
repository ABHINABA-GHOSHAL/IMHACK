import { useState } from "react"
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom"
import { LayoutDashboard, FileText, Activity, Bell, BarChart3, Brain, ChevronRight, Menu, X } from "lucide-react"
import Dashboard from "./pages/Dashboard"
import DocumentCopilot from "./pages/DocumentCopilot"
import SprintMonitor from "./pages/SprintMonitor"
import Reminders from "./pages/Reminders"
import StatusReports from "./pages/StatusReports"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Doc Copilot", icon: FileText },
  { to: "/sprint", label: "Sprint Monitor", icon: Activity },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/reports", label: "Status Reports", icon: BarChart3 },
]

function Sidebar({ open, setOpen }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-30 transform transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Brain size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Project Intelligence</p>
            <p className="text-xs text-slate-400">Documentation Copilot</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">IndiaMart 10X AI Hackathon</p>
          <p className="text-xs text-slate-600 text-center">May 15-16, 2026</p>
        </div>
      </aside>
    </>
  )
}

function Header({ setOpen }) {
  const location = useLocation()
  const current = navItems.find(n => n.to === location.pathname || (n.to !== "/" && location.pathname.startsWith(n.to))) || navItems[0]
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      <button className="lg:hidden text-slate-500 hover:text-slate-700" onClick={() => setOpen(true)}><Menu size={22} /></button>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>IndiaMart</span><ChevronRight size={14} /><span className="font-semibold text-slate-800">{current.label}</span>
      </div>
      <div className="ml-auto">
        <span className="hidden sm:flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />AI Online
        </span>
      </div>
    </header>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header setOpen={setSidebarOpen} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/documents" element={<DocumentCopilot />} />
              <Route path="/sprint" element={<SprintMonitor />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/reports" element={<StatusReports />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

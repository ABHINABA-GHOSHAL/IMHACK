import { useState } from "react"
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from "react-router-dom"
import { LayoutDashboard, FileText, Activity, BarChart3, Brain, ChevronRight, Menu, X, LogOut, Search } from "lucide-react"
import Dashboard from "./pages/Dashboard"
import DocumentCopilot from "./pages/DocumentCopilot"
import SprintMonitor from "./pages/SprintMonitor"
import TicketAnalysis from "./pages/TicketAnalysis"
import StatusReports from "./pages/StatusReports"
import Login from "./pages/Login"
import { AuthProvider, useAuth } from "./context/AuthContext"

const NAV = [
  { to: "/",          label: "Dashboard",      icon: LayoutDashboard, desc: "Overview",        accent: "#818cf8" },
  { to: "/documents", label: "Doc Copilot",    icon: FileText,        desc: "BRD & Docs",      accent: "#818cf8" },
  { to: "/sprint",    label: "Sprint Monitor", icon: Activity,        desc: "Health & Alerts", accent: "#34d399" },
  { to: "/analysis",  label: "Ticket Analysis", icon: Search,         desc: "Single Ticket",   accent: "#f97316" },
  { to: "/reports",   label: "Status Reports", icon: BarChart3,       desc: "Auto Reports",    accent: "#a78bfa" },
]

function Sidebar({ open, setOpen }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-64 z-30 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:translate-x-0 lg:z-auto shrink-0`}
        style={{ background: "linear-gradient(170deg, #18154a 0%, #25206e 55%, #18154a 100%)" }}
      >
        {/* Brand */}
        <div className="px-4 pt-5 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)" }}
            >
              <Brain size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">IM-InsightOps</p>
              <p className="text-[11px] text-indigo-300/75 mt-0.5">IndiaMART Project Copilot</p>
            </div>
            <button
              className="lg:hidden text-indigo-300 hover:text-white p-1 rounded-lg transition-colors shrink-0"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mx-4 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

        <p className="px-5 pt-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400/50">
          Navigation
        </p>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          {NAV.map(({ to, label, icon: Icon, desc, accent }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                  isActive
                    ? "text-white"
                    : "text-indigo-200/55 hover:text-indigo-100 hover:bg-white/[0.05]"
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: "rgba(255,255,255,0.10)" } : {}
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                      style={{ background: accent }}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isActive ? "" : "bg-white/[0.05] group-hover:bg-white/[0.09]"
                    }`}
                    style={
                      isActive
                        ? { background: `${accent}28`, boxShadow: `0 2px 10px ${accent}30` }
                        : {}
                    }
                  >
                    <Icon
                      size={15}
                      style={{ color: isActive ? accent : "#a5b4fc" }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-semibold leading-tight ${isActive ? "text-white" : "text-indigo-100/70"}`}>
                      {label}
                    </p>
                    <p className={`text-[11px] leading-tight ${isActive ? "text-indigo-300/75" : "text-indigo-400/45"}`}>
                      {desc}
                    </p>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

      </aside>
    </>
  )
}

function Header({ setSidebarOpen }) {
  const loc = useLocation()
  const { user, logout } = useAuth()
  const current =
    NAV.find(
      (n) => n.to === loc.pathname || (n.to !== "/" && loc.pathname.startsWith(n.to))
    ) || NAV[0]

  return (
    <header className="h-14 flex items-center gap-3 px-5 bg-white border-b border-slate-200/80 shadow-sm shrink-0">
      <button
        className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu size={18} />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
        <span className="text-slate-400 font-medium hidden sm:block">IM-InsightOps</span>
        <ChevronRight size={12} className="text-slate-300 hidden sm:block" />
        <span className="font-bold text-slate-800 truncate">{current.label}</span>
        <span className="hidden md:block text-xs text-slate-400">— {current.desc}</span>
      </div>
      {user && (
        <div className="flex items-center gap-2 ml-1">
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border border-slate-200" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold border border-indigo-200">
              {(user.name || user.email || "?")[0].toUpperCase()}
            </div>
          )}
          <span className="hidden lg:block text-xs text-slate-600 font-medium max-w-[120px] truncate">{user.name || user.email}</span>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
    </header>
  )
}

function ProtectedLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout />
}

function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f1f5f9" }}>
      <Sidebar open={open} setOpen={setOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header setSidebarOpen={setOpen} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 max-w-[1280px] mx-auto w-full">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/documents" element={<DocumentCopilot />} />
              <Route path="/sprint" element={<SprintMonitor />} />
              <Route path="/analysis" element={<TicketAnalysis />} />
              <Route path="/reports" element={<StatusReports />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

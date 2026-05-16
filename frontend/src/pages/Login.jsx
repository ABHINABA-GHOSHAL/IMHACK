import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, Brain, Shield } from "lucide-react"
import { login as loginApi, signup as signupApi } from "../api/client"
import { useAuth } from "../context/AuthContext"

function LoginCard() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail.endsWith("@indiamart.com")) {
        throw new Error("Only @indiamart.com accounts are allowed.")
      }

      const payload = mode === "signup"
        ? { name: name.trim(), email: normalizedEmail, password }
        : { email: normalizedEmail, password }
      const r = mode === "signup" ? await signupApi(payload) : await loginApi(payload)

      login({
        email: r.data.user?.email,
        name: r.data.user?.name,
      }, r.data.token)
      navigate("/", { replace: true })
    } catch (e) {
      setError(e.message || "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* Background circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#6366f1,transparent)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#8b5cf6,transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: "radial-gradient(circle,#fff,transparent)" }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            {/* Logo */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl"
              style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)" }}
            >
              <Brain size={30} className="text-white" />
            </div>

            <h1 className="text-2xl font-extrabold text-white mb-1">
              IM-InsightOps
            </h1>
            <p className="text-sm text-indigo-300">
              IndiaMART Project Copilot
            </p>
          </div>

          {/* Divider */}
          <div className="mx-8 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Body */}
          <div className="px-8 py-8 space-y-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                onClick={() => { setMode("login"); setError("") }}
                className={`rounded-md py-2 text-xs font-bold transition ${mode === "login" ? "text-white" : "text-indigo-200"}`}
                style={mode === "login" ? { background: "rgba(99,102,241,0.5)" } : {}}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError("") }}
                className={`rounded-md py-2 text-xs font-bold transition ${mode === "signup" ? "text-white" : "text-indigo-200"}`}
                style={mode === "signup" ? { background: "rgba(99,102,241,0.5)" } : {}}
              >
                Sign Up
              </button>
            </div>

            {/* Restriction notice */}
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              <Shield size={15} className="text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-200 leading-relaxed">
                Access is restricted to{" "}
                <span className="font-bold text-white">@indiamart.com</span>{" "}
                accounts only. {mode === "signup" ? "Create your account first." : "Sign in with your work email."}
              </p>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <p className="text-xs text-red-300 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl px-3 py-3 text-sm text-slate-900 bg-white/95 outline-none border border-white/60 focus:border-indigo-300"
                  required
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@indiamart.com"
                className="w-full rounded-xl px-3 py-3 text-sm text-slate-900 bg-white/95 outline-none border border-white/60 focus:border-indigo-300"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="w-full rounded-xl px-3 py-3 text-sm text-slate-900 bg-white/95 outline-none border border-white/60 focus:border-indigo-300"
                minLength={8}
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "white" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
              </button>
            </form>

            <p className="text-center text-[11px] text-indigo-400/60 leading-relaxed">
              By continuing you agree to IndiaMart's internal usage policy.
              <br />
              This tool is for internal PM use only.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-indigo-400/40 mt-6">
          IM-InsightOps · IndiaMART · v1.0
        </p>
      </div>
    </div>
  )
}

export default function Login() {
  return <LoginCard />
}

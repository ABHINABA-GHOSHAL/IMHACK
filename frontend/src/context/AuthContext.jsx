import { createContext, useContext, useState, useCallback } from "react"

const AuthContext = createContext(null)

const SESSION_KEY = "im_user"
const TOKEN_KEY = "im_token"

function loadUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "")

  const login = useCallback((userData, jwtToken) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    if (jwtToken) sessionStorage.setItem(TOKEN_KEY, jwtToken)
    setToken(jwtToken || "")
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    setToken("")
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user && !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

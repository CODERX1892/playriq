import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(null)      // logged-in player
  const [appUser, setAppUser] = useState(null)    // analyst/coach/admin

  const loginPlayer = (p) => { setPlayer(p); setAppUser(null) }
  const loginAppUser = (u) => { setAppUser(u); setPlayer(null) }
  const logout = () => { setPlayer(null); setAppUser(null) }

  const isAdmin = appUser?.role === 'admin'
  const isCoach = appUser?.role === 'coach' || isAdmin
  const isAnalyst = appUser?.role === 'analyst' || isCoach

  return (
    <AuthContext.Provider value={{ player, appUser, loginPlayer, loginAppUser, logout, isAdmin, isCoach, isAnalyst }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

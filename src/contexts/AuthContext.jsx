import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(null)    // logged-in player object
  const [isCoach, setIsCoach] = useState(false) // coach mode

  const loginPlayer = (p) => { setPlayer(p); setIsCoach(false) }
  const loginCoach = () => { setIsCoach(true); setPlayer(null) }
  const logout = () => { setPlayer(null); setIsCoach(false) }

  return (
    <AuthContext.Provider value={{ player, isCoach, loginPlayer, loginCoach, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

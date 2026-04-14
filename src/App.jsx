import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import PlayerPortal from './pages/PlayerPortal'
import CoachDashboard from './pages/CoachDashboard'

function AppInner() {
  const { player, isCoach } = useAuth()
  if (isCoach) return <CoachDashboard />
  if (player) return <PlayerPortal />
  return <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <div className="page">
        <AppInner />
      </div>
    </AuthProvider>
  )
}

import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import PlayerPortal from './pages/PlayerPortal'
import CoachDashboard from './pages/CoachDashboard'
import AnalystDashboard from './pages/AnalystDashboard'

function AppInner() {
  const { player, appUser, isAdmin, isCoach, isAnalyst } = useAuth()
  if (player) return <PlayerPortal />
  if (appUser) {
    if (isCoach || isAdmin) return <CoachDashboard />
    if (isAnalyst) return <AnalystDashboard />
  }
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

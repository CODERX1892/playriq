import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { setCompFilter } from './lib/utils'
import Login from './pages/Login'
import PlayerPortal from './pages/PlayerPortal'
import CoachDashboard from './pages/CoachDashboard'
import AnalystDashboard from './pages/AnalystDashboard'

// Staff-only League / Championship filter. Sits above the active dashboard.
// Challenge games bucket with League (see _normComp in lib/utils).
function CompToggle({ value, onChange }) {
  const opts = [['all', 'All'], ['league', 'League'], ['championship', 'Championship']]
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '8px 10px' }}>
      {opts.map(([k, label]) => {
        const active = value === k
        return (
          <button key={k} onClick={() => onChange(k)}
            style={{
              flex: '0 1 auto', padding: '6px 14px', borderRadius: 999, fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif',
              border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
              background: active ? 'rgba(74,158,255,0.14)' : 'var(--bg3)',
              color: active ? 'var(--blue)' : 'var(--text3)',
            }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

function AppInner() {
  const { player, appUser, isAdmin, isCoach, isAnalyst } = useAuth()
  const [comp, setComp] = useState('all')

  const choose = (c) => { setCompFilter(c); setComp(c) }

  if (player) return <PlayerPortal />

  if (appUser && (isCoach || isAdmin || isAnalyst)) {
    // key={comp} remounts the dashboard on filter change so its data effects
    // re-run and re-read the now-filtered MATCHES / inActiveComp set.
    const dash = (isCoach || isAdmin)
      ? <CoachDashboard key={comp} />
      : <AnalystDashboard key={comp} />
    return (
      <>
        <CompToggle value={comp} onChange={choose} />
        {dash}
      </>
    )
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

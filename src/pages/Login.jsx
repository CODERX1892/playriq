import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import PinPad from '../components/PinPad'
import { COACH_PIN } from '../lib/utils'

const CREST_URL = 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Ballyboden_St_Endas_GAA_crest.png/200px-Ballyboden_St_Endas_GAA_crest.png'

export default function Login() {
  const { loginPlayer, loginCoach } = useAuth()
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState('name') // name | pin | coach
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    supabase.from('players').select('name,position,pin,irish_name,dob,photo_url')
      .then(({ data }) => { setPlayers(data || []); setLoading(false) })
  }, [])

  useEffect(() => {
    if (query.length < 2) { setHits([]); return }
    const q = query.toLowerCase()
    setHits(players.filter(p => p.name.toLowerCase().includes(q)).slice(0, 7))
  }, [query, players])

  const pick = (player) => {
    setSelected(player)
    setQuery(player.name)
    setHits([])
    setStep('pin')
    setPinError('')
  }

  const handlePin = (pin) => {
    if (selected && pin === selected.pin) {
      loginPlayer(selected)
    } else {
      setPinError('Incorrect PIN — try again')
    }
  }

  const handleCoachPin = (pin) => {
    if (pin === COACH_PIN) loginCoach()
    else setPinError('Incorrect PIN')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ marginBottom: 4, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, letterSpacing: 2, color: 'var(--gold)' }}>
          PlayrIQ
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>
          Ballyboden St Enda's · 2026
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 360, marginTop: 24 }}>
        <div className="card" style={{ padding: 22 }}>

          {/* STEP: NAME SEARCH */}
          {step === 'name' && (
            <div className="fade-in">
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>
                Enter your name
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Start typing..."
                  autoComplete="off"
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text)', fontSize: 15,
                    fontFamily: 'Barlow, sans-serif', outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--border2)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                {hits.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    borderTop: 'none', borderRadius: '0 0 8px 8px', zIndex: 50,
                    maxHeight: 220, overflowY: 'auto',
                  }}>
                    {hits.map(p => (
                      <div key={p.name} onClick={() => pick(p)}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          borderTop: '1px solid rgba(26,51,86,0.4)',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <Avatar name={p.name} size={28} />
                        <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{p.position}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { setStep('coach'); setPinError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', letterSpacing: 1, fontFamily: 'Barlow, sans-serif' }}>
                  COACH LOGIN →
                </button>
              </div>
            </div>
          )}

          {/* STEP: PLAYER PIN */}
          {step === 'pin' && selected && (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <Avatar name={selected.name} size={40} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selected.position}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                Enter PIN
              </div>
              <PinPad onSubmit={handlePin} error={pinError} />
              <button onClick={() => { setStep('name'); setSelected(null); setQuery(''); setPinError('') }}
                style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                ← Back
              </button>
            </div>
          )}

          {/* STEP: COACH PIN */}
          {step === 'coach' && (
            <div className="fade-in">
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Coach Access</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Ballyboden St Enda's 2026</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                Enter Coach PIN
              </div>
              <PinPad onSubmit={handleCoachPin} error={pinError} dotColor="var(--blue)" />
              <button onClick={() => { setStep('name'); setPinError('') }}
                style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

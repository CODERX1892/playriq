import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import PinPad from '../components/PinPad'

export default function Login() {
  const { loginPlayer, loginAppUser } = useAuth()
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [appUsers, setAppUsers] = useState([])
  const [step, setStep] = useState('name') // name | pin | staff | forgot | forgotCode
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(true)
  const [forgotName, setForgotName] = useState('')
  const [forgotStatus, setForgotStatus] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [resetStep, setResetStep] = useState('email') // email | code | newpin
  const inputRef = useRef(null)

  // Crest as data URI will be injected by build process
  const CREST_URL = '/crest.png'

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('name,position,pin,irish_name,dob,photo_url,email,role'),
      supabase.from('app_users').select('*').eq('active', true).order('name'),
    ]).then(([{ data: pData }, { data: uData }]) => {
      setPlayers(pData || [])
      setAppUsers(uData || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (query.length < 2) { setHits([]); return }
    const q = query.toLowerCase()
    setHits(players.filter(p => p.name.toLowerCase().includes(q)).slice(0, 7))
  }, [query, players])

  const pick = (player) => {
    setSelected(player); setQuery(player.name); setHits([]); setStep('pin'); setPinError('')
  }

  const handlePlayerPin = (pin) => {
    if (selected && pin === selected.pin) loginPlayer(selected)
    else setPinError('Incorrect PIN — try again')
  }

  const handleStaffPin = (pin) => {
    if (!selectedStaff) return
    if (pin === selectedStaff.pin) loginAppUser(selectedStaff)
    else setPinError('Incorrect PIN — try again')
  }

  const handleForgotSubmit = async () => {
    const player = players.find(p => p.name.toLowerCase() === forgotName.toLowerCase())
    if (!player || !player.email) {
      setForgotStatus('No account found with that name.')
      return
    }
    const token = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await supabase.from('pin_reset_tokens').insert({ player_name: player.name, email: player.email, token, expires_at: expires })
    // Send email via our API route (will be a Vercel serverless function)
    try {
      await fetch('/api/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: player.email, name: player.name, token })
      })
    } catch(e) {}
    setForgotStatus(`Code sent to ${player.email.replace(/(.{2}).*(@.*)/, '$1***$2')}`)
    setResetStep('code')
  }

  const handleResetCode = async () => {
    const player = players.find(p => p.name.toLowerCase() === forgotName.toLowerCase())
    if (!player) return
    const { data } = await supabase.from('pin_reset_tokens')
      .select('*').eq('player_name', player.name).eq('token', resetCode).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single()
    if (data) { setResetStep('newpin'); setPinError('') }
    else setPinError('Invalid or expired code')
  }

  const handleNewPin = async () => {
    if (newPin.length !== 4) { setPinError('PIN must be 4 digits'); return }
    const player = players.find(p => p.name.toLowerCase() === forgotName.toLowerCase())
    await supabase.from('players').update({ pin: newPin }).eq('name', player.name)
    await supabase.from('pin_reset_tokens').update({ used: true }).eq('player_name', player.name).eq('token', resetCode)
    setStep('name'); setForgotName(''); setResetCode(''); setNewPin(''); setResetStep('email')
    setPinError('PIN updated — please log in')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ marginBottom: 4, textAlign: 'center' }}>
        <img src="/crest.png" alt="Ballyboden St Enda's"
          onError={e => e.target.style.display='none'}
          style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: 10, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: 1, marginBottom: 4 }}>Ballyboden St Enda's</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: 3, color: 'var(--gold)', textTransform: 'uppercase' }}>PlayrIQ</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>Player Portal · 2026</div>
      </div>

      <div style={{ width: '100%', maxWidth: 360, marginTop: 24 }}>
        <div className="card" style={{ padding: 22 }}>

          {/* NAME SEARCH */}
          {step === 'name' && (
            <div className="fade-in">
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>Enter your name</div>
              <div style={{ position: 'relative' }}>
                <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Start typing..." autoComplete="off"
                  style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 15, fontFamily: 'Barlow, sans-serif', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor='var(--border2)'}
                  onBlur={e => e.target.style.borderColor='var(--border)'} />
                {hits.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg3)', border: '1px solid var(--border2)', borderTop: 'none', borderRadius: '0 0 8px 8px', zIndex: 50, maxHeight: 220, overflowY: 'auto' }}>
                    {hits.map(p => (
                      <div key={p.name} onClick={() => pick(p)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid rgba(26,51,86,0.4)', display: 'flex', alignItems: 'center', gap: 10 }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg4)'}
                        onMouseLeave={e => e.currentTarget.style.background=''}>
                        <Avatar name={p.name} size={28} />
                        <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{p.position}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 20 }}>
                <button onClick={() => { setStep('staff'); setPinError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                  Coach / Analyst Login →
                </button>
                <button onClick={() => { setStep('forgot'); setForgotStatus(''); setResetStep('email') }}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                  Forgot PIN
                </button>
              </div>
            </div>
          )}

          {/* PLAYER PIN */}
          {step === 'pin' && selected && (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <Avatar name={selected.name} size={40} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selected.position}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>Enter PIN</div>
              <PinPad onSubmit={handlePlayerPin} error={pinError} />
              <button onClick={() => { setStep('name'); setSelected(null); setQuery(''); setPinError('') }}
                style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                ← Back
              </button>
              <button onClick={() => { setForgotName(selected.name); setStep('forgot'); setForgotStatus(''); setResetStep('email') }}
                style={{ display: 'block', width: '100%', marginTop: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                Forgot PIN?
              </button>
            </div>
          )}

          {/* STAFF NAME SELECT */}
          {step === 'staff' && !selectedStaff && (
            <div className="fade-in">
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>Select your name</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {appUsers.map(u => (
                  <div key={u.id} onClick={() => { setSelectedStaff(u); setPinError('') }}
                    style={{ padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = u.role === 'analyst' ? 'var(--teal)' : 'var(--blue)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: u.role === 'admin' ? 'var(--gold)' : u.role === 'analyst' ? 'var(--teal)' : 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1 }}>{u.role === 'analyst' ? 'Analyst' : u.role === 'admin' ? 'Admin' : 'Coach'}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { setStep('name'); setPinError('') }}
                style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                ← Back
              </button>
            </div>
          )}

          {/* STAFF PIN */}
          {step === 'staff' && selectedStaff && (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg4)', border: '2px solid var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--blue)', flexShrink: 0 }}>
                  {selectedStaff.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedStaff.name}</div>
                  <div style={{ fontSize: 11, color: selectedStaff.role === 'admin' ? 'var(--gold)' : 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{selectedStaff.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>Enter PIN</div>
              <PinPad onSubmit={handleStaffPin} error={pinError} dotColor="var(--blue)" />
              <button onClick={() => { setSelectedStaff(null); setPinError('') }}
                style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                ← Back
              </button>
            </div>
          )}

          {/* FORGOT PIN */}
          {step === 'forgot' && (
            <div className="fade-in">
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Reset PIN</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>We'll send a code to your email</div>
              </div>

              {resetStep === 'email' && (
                <>
                  <input value={forgotName} onChange={e => setForgotName(e.target.value)}
                    placeholder="Your full name..."
                    style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow, sans-serif', outline: 'none', marginBottom: 10 }} />
                  <button onClick={handleForgotSubmit}
                    style={{ width: '100%', padding: 11, background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 8, color: 'var(--gold)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                    Send Reset Code
                  </button>
                  {forgotStatus && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--teal)', textAlign: 'center' }}>{forgotStatus}</div>}
                </>
              )}

              {resetStep === 'code' && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--teal)', textAlign: 'center', marginBottom: 12 }}>{forgotStatus}</div>
                  <input value={resetCode} onChange={e => setResetCode(e.target.value)}
                    placeholder="6-digit code" maxLength={6}
                    style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 18, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textAlign: 'center', outline: 'none', marginBottom: 10, letterSpacing: 4 }} />
                  {pinError && <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{pinError}</div>}
                  <button onClick={handleResetCode}
                    style={{ width: '100%', padding: 11, background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 8, color: 'var(--gold)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                    Verify Code
                  </button>
                </>
              )}

              {resetStep === 'newpin' && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginBottom: 12 }}>Choose a new 4-digit PIN</div>
                  <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/,'').slice(0,4))}
                    placeholder="4 digits" maxLength={4} type="password"
                    style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textAlign: 'center', outline: 'none', marginBottom: 10, letterSpacing: 8 }} />
                  {pinError && <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{pinError}</div>}
                  <button onClick={handleNewPin}
                    style={{ width: '100%', padding: 11, background: 'rgba(62,207,142,0.12)', border: '1px solid var(--teal)', borderRadius: 8, color: 'var(--teal)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                    Set New PIN
                  </button>
                </>
              )}

              <button onClick={() => { setStep('name'); setPinError(''); setForgotStatus('') }}
                style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                ← Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

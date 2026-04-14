import { useState } from 'react'

export default function PinPad({ onSubmit, error, dotColor = 'var(--gold)' }) {
  const [pin, setPin] = useState('')

  const press = (d) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      setTimeout(() => { onSubmit(next); setPin('') }, 200)
    }
  }

  const del = () => setPin(p => p.slice(0, -1))

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div>
      <div className="pin-dots">
        {[0,1,2,3].map(i => (
          <div key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`}
            style={i < pin.length ? { background: dotColor, borderColor: dotColor } : {}} />
        ))}
      </div>
      <div className="keypad">
        {keys.map((k, i) => {
          if (k === '') return <div key={i} className="key empty" />
          if (k === 'del') return <div key={i} className="key" onClick={del} style={{ fontSize: 18, color: 'var(--text3)' }}>⌫</div>
          return <div key={i} className="key" onClick={() => press(k)}>{k}</div>
        })}
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', marginTop: 10, minHeight: 16 }}>{error}</div>}
    </div>
  )
}

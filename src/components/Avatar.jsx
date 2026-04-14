export default function Avatar({ name, size = 40, round = true, style = {} }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const br = round ? '50%' : size > 50 ? '11px' : '50%'
  const fs = Math.round(size * 0.32)

  return (
    <div style={{
      width: size, height: size,
      borderRadius: br,
      background: 'var(--bg4)',
      border: '2px solid var(--gold)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Barlow Condensed, sans-serif',
      fontWeight: 800, fontSize: fs,
      color: 'var(--gold)',
      flexShrink: 0,
      ...style
    }}>
      {initials}
    </div>
  )
}

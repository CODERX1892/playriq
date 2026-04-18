import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Colour palette based on initials
const COLORS = [
  ['#1a3a5c','#4a9eff'], ['#1a3a2a','#3ecf8e'], ['#3a2a0a','#f0b429'],
  ['#2a1a3a','#a78bfa'], ['#3a1a1a','#f06060'], ['#1a2a3a','#64b5f6'],
]

function getColor(name) {
  const i = (name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length
  return COLORS[i]
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

// Read-only avatar — used in coach views, leaderboards, compare etc
export default function Avatar({ name, size = 36, round = true, photoUrl = null }) {
  const [bg, fg] = getColor(name)
  const initials = getInitials(name)
  const radius = round ? '50%' : '10px'

  if (photoUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        overflow: 'hidden', border: `2px solid ${fg}33`,
      }}>
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: bg,
      border: `2px solid ${fg}66`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, userSelect: 'none',
    }}>
      <span style={{
        fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
        fontSize: Math.round(size * 0.38), color: fg, lineHeight: 1,
      }}>{initials}</span>
    </div>
  )
}

// Editable avatar — used in player portal header, allows photo upload
export function EditableAvatar({ player, size = 76, onPhotoUpdated }) {
  const [bg, fg] = getColor(player.name)
  const initials = getInitials(player.name)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(player.photo_url || null)
  const inputRef = useRef(null)

  const handleTap = () => inputRef.current?.click()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    setUploading(true)
    try {
      // Resize/compress using canvas before upload
      const compressed = await compressImage(file, 400)
      const fileName = `${player.name.replace(/\s+/g, '_').replace(/'/g, '')}_${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Save URL to players table
      await supabase.from('players')
        .update({ photo_url: publicUrl })
        .eq('name', player.name)

      setPhotoUrl(publicUrl)
      if (onPhotoUpdated) onPhotoUpdated(publicUrl)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={handleTap}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {/* Avatar circle */}
      {photoUrl ? (
        <div style={{
          width: size, height: size, borderRadius: '10px',
          overflow: 'hidden', border: `2px solid ${fg}66`,
        }}>
          <img src={photoUrl} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '10px', background: bg,
          border: `2px solid ${fg}66`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', userSelect: 'none',
        }}>
          <span style={{
            fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
            fontSize: Math.round(size * 0.38), color: fg, lineHeight: 1,
          }}>{initials}</span>
        </div>
      )}

      {/* Camera overlay */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 22, height: 22, borderRadius: '50%',
        background: uploading ? 'var(--bg3)' : 'var(--blue)',
        border: '2px solid var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        {uploading
          ? <div style={{ width: 10, height: 10, border: '2px solid var(--text3)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm7-11h-1.8l-1.4-2H8.2L6.8 4.2H5A3 3 0 0 0 2 7.2v11A3 3 0 0 0 5 21.2h14a3 3 0 0 0 3-3V7.2a3 3 0 0 0-3-3z"/>
            </svg>
        }
      </div>
    </div>
  )
}

// Compress image to max dimension using canvas
async function compressImage(file, maxDim = 400) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

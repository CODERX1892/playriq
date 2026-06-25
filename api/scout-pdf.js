// Server-side reader for the GAA Insights Conceding shot chart + opponent
// shot-origin table. Runs in Node (Vercel), where pdf.js hands over the embedded
// chart bitmap reliably — unlike the browser — so the box read is correct on
// every report. Falls back to the in-browser reader only when this isn't reachable
// (e.g. plain `npm run dev`, which doesn't run api/ functions).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readBoxesFromChart } from '../src/lib/scoutShotChart.js'

// pdf.js decoded-image (kind 2 = RGB, 3 = RGBA) -> RGBA bytes
function toRGBA(img) {
  const { width: w, height: h, data, kind } = img
  if (kind === 3 || data.length === w * h * 4) return data
  const out = new Uint8ClampedArray(w * h * 4)
  if (kind === 2 || data.length === w * h * 3) {
    for (let p = 0, q = 0; p < w * h; p++) {
      out[q++] = data[p * 3]; out[q++] = data[p * 3 + 1]; out[q++] = data[p * 3 + 2]; out[q++] = 255
    }
    return out
  }
  out.fill(255)
  return out
}

// Rebuild text rows from positioned glyphs (group by y, sort by x).
function textRows(tc) {
  const byY = {}
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue
    const y = Math.round(it.transform[5])
    ;(byY[y] ||= []).push({ x: it.transform[4], s: it.str })
  }
  return Object.keys(byY).map(Number).sort((a, b) => b - a)
    .map(y => byY[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim())
}

// Opponent possession-origin: Opp_Third = their deep/defensive end, Team_Third =
// their attacking end near our goal, Middle = middle. Sum the three source rows.
function zoneToSlot(t) {
  t = t.toLowerCase()
  if (t.startsWith('opp')) return 'def'
  if (t.startsWith('team')) return 'att'
  return 'mid'
}
function extractShotOrigins(rs) {
  const idx = rs.findIndex(r => /opposition shots originated/i.test(r))
  if (idx < 0) return null
  const win = rs.slice(idx, idx + 9)
  let order = ['def', 'mid', 'att']
  const h = win.find(l => /Total/i.test(l) && /(Opp[_ ]?Third|Team[_ ]?Third)/i.test(l))
  if (h) {
    const t = []; const re = /(Opp[_ ]?Third|Team[_ ]?Third|Middle)/gi; let m
    while ((m = re.exec(h))) t.push(zoneToSlot(m[1]))
    if (t.length === 3) order = t
  }
  const grab = (lbl) => {
    const row = win.find(r => new RegExp('^' + lbl + '\\s+\\d', 'i').test(r))
    if (!row) return null
    const n = (row.match(/\d+/g) || []).map(Number)
    return n.length >= 4 ? n.slice(1, 4) : null
  }
  const src = ['Turnover', 'Opp(?:osition)? ?KO', 'Team ?KO'].map(grab).filter(Boolean)
  if (!src.length) return null
  const acc = { att: 0, mid: 0, def: 0 }
  src.forEach(r => r.forEach((v, i) => { acc[order[i]] += v }))
  const tot = acc.att + acc.mid + acc.def
  if (tot < 5 || tot > 60) return null
  return acc
}

// Locate the largest image XObject on a page and resolve its decoded bitmap.
async function readConcedingImage(page) {
  const ops = await page.getOperatorList()
  const OPS = pdfjs.OPS
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  let ctm = [1, 0, 0, 1, 0, 0]; const st = []; let name = null; let area = 0
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i]
    if (fn === OPS.save) st.push(ctm.slice())
    else if (fn === OPS.restore) ctm = st.pop() || ctm
    else if (fn === OPS.transform) ctm = mul(ctm, a)
    else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const ar = Math.hypot(ctm[0], ctm[1]) * Math.hypot(ctm[2], ctm[3])
      if (ar > area) { area = ar; name = a[0] }
    }
  }
  if (!name) return null
  return await new Promise((resolve) => {
    let done = false
    const f = (o) => { if (!done) { done = true; resolve(o || null) } }
    try { page.objs.get(name, f) } catch { f(null) }
    setTimeout(() => f(null), 8000)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { pdfBase64 } = req.body || {}
  if (!pdfBase64) return res.status(400).json({ error: 'Missing pdfBase64' })

  try {
    const data = new Uint8Array(Buffer.from(pdfBase64, 'base64'))
    const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise

    let concedingPage = null, originRows = null
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const rows = textRows(await page.getTextContent())
      const text = rows.join(' ')
      if (!originRows && /opposition shots originated/i.test(text)) originRows = rows
      if (/Shots Conceded/i.test(text)) concedingPage = p
      else if (concedingPage == null && /Conceding/i.test(text)) concedingPage = p
    }

    const shot_origins = originRows ? extractShotOrigins(originRows) : null

    let shot_zones = null
    if (concedingPage != null) {
      const page = await pdf.getPage(concedingPage)
      const img = await readConcedingImage(page)
      if (img && img.data && img.width > 50) {
        const rgba = toRGBA(img)
        const W = img.width, H = img.height
        const cutX = Math.round(W * 0.47) // dot chart = left ~47%; heatmap on the right
        const r = readBoxesFromChart(rgba, W, H, { x0: 0, y0: 0, x1: cutX, y1: H }, Math.max(18, Math.round((W * H) / 15000)))
        if (r && r.zones) shot_zones = r.zones
      }
    }

    return res.json({ shot_zones, shot_origins })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}

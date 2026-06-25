// Server-side reader for the GAA Insights Conceding shot chart + opponent
// shot-origin table. Runs in Node (Vercel), where pdf.js reliably yields the
// embedded chart bitmap — unlike the browser — so the box read is correct on
// every report. SELF-CONTAINED: no imports outside this file (so the serverless
// bundle can't break on a missing module).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// Vercel's bundler can't follow pdf.js's *dynamic* worker import, so it drops
// pdf.worker.mjs from the deployed function. pdf.js then fails to set up its
// main-thread "fake worker" and getDocument throws — the endpoint 500s on the
// Lambda ("Cannot find module .../pdf.worker.mjs") even though it runs fine
// locally. Pin workerSrc to the resolved file: the load succeeds, and the
// require.resolve() call is statically analysable so @vercel/nft bundles the
// file too. (vercel.json `includeFiles` belt-and-suspenders the same path.)
try {
  const require = createRequire(import.meta.url)
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href
} catch { /* leave pdf.js to its default resolution */ }

/* ---------- shot-chart pixel detection (inlined from scoutShotChart.js) ---------- */
const BOX_GRID = [[15, 14, 13], [12, 11, 10], [9, 0, 8]]
const isMiss = (r, g, b) => r > 120 && r - g > 55 && r - b > 45 && g < 90
const isPoint = (r, g, b) => b > 110 && b - r > 40 && b - g > 30
const isGoal = (r, g, b) => r > 170 && g > 160 && b < 110 && Math.abs(r - g) < 60
const is2pt = (r, g, b) => r > 185 && g > 95 && g < 170 && b < 85
const isScore = (r, g, b) => isPoint(r, g, b) || isGoal(r, g, b) || is2pt(r, g, b)
const anyColour = (r, g, b) => Math.abs(r - g) > 25 || Math.abs(g - b) > 25 || Math.abs(r - b) > 25
const FREE_FILL = 0.68

function components(data, width, box, test, minSize, maxSize = 600) {
  const { x0, y0, x1, y1 } = box
  const bw = x1 - x0, bh = y1 - y0
  if (bw <= 0 || bh <= 0) return []
  const seen = new Uint8Array(bw * bh)
  const at = (lx, ly) => { const i = ((ly + y0) * width + (lx + x0)) * 4; return test(data[i], data[i + 1], data[i + 2]) }
  const blobs = [], stack = []
  for (let sy = 0; sy < bh; sy++) {
    for (let sx = 0; sx < bw; sx++) {
      const s0 = sy * bw + sx
      if (seen[s0] || !at(sx, sy)) continue
      let n = 0, sX = 0, sY = 0, minX = sx, maxX = sx, minY = sy, maxY = sy
      stack.length = 0; stack.push(s0); seen[s0] = 1
      while (stack.length) {
        const p = stack.pop(), px = p % bw, py = (p / bw) | 0
        n++; sX += px; sY += py
        if (px < minX) minX = px; if (px > maxX) maxX = px
        if (py < minY) minY = py; if (py > maxY) maxY = py
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
          const np = ny * bw + nx
          if (seen[np] || !at(nx, ny)) continue
          seen[np] = 1; stack.push(np)
        }
      }
      if (n >= minSize && n <= maxSize) {
        const bbox = (maxX - minX + 1) * (maxY - minY + 1)
        blobs.push({ x: x0 + sX / n, y: y0 + sY / n, n, fill: n / bbox })
      }
    }
  }
  return blobs
}

function leftChartBox(data, width, box) {
  const { x0, y0, x1, y1 } = box
  const bw = x1 - x0, bh = y1 - y0
  const colFrac = new Float32Array(bw)
  for (let lx = 0; lx < bw; lx++) {
    let c = 0
    for (let ly = 0; ly < bh; ly += 2) {
      const i = ((ly + y0) * width + (lx + x0)) * 4
      if (anyColour(data[i], data[i + 1], data[i + 2])) c++
    }
    colFrac[lx] = c / (bh / 2)
  }
  let cut = bw
  for (let lx = Math.floor(bw * 0.35); lx < bw; lx++) {
    if (colFrac[lx] > 0.6) { cut = lx - Math.floor(bw * 0.02); break }
  }
  return { x0, y0, x1: x0 + Math.max(0, cut), y1 }
}

function dotsToBoxes(scores, misses, box, medianArea) {
  const { x0, y0, x1, y1 } = box
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0)
  const med = medianArea || 1
  const z = {}
  const place = (d, kind) => {
    const band = Math.min(2, Math.max(0, Math.floor(((d.y - y0) / h) * 3)))
    const ch = Math.min(2, Math.max(0, Math.floor(((d.x - x0) / w) * 3)))
    const k = String(BOX_GRID[band][ch])
    const n = Math.max(1, Math.round(d.n / med))
    const cell = (z[k] ||= { sc: 0, ms: 0, fr: 0, total: 0, pct: 0 })
    cell[kind] += n
    if (d.fill < FREE_FILL) cell.fr += n
  }
  scores.forEach(d => place(d, 'sc'))
  misses.forEach(d => place(d, 'ms'))
  for (const k of Object.keys(z)) { const c = z[k]; c.total = c.sc + c.ms; c.pct = c.total ? Math.round((c.sc / c.total) * 100) : 0 }
  return z
}

function readBoxesFromChart(data, width, height, imageBox, minSize) {
  const lc = leftChartBox(data, width, imageBox)
  const scores = components(data, width, lc, isScore, minSize)
  const misses = components(data, width, lc, isMiss, minSize)
  const all = scores.concat(misses)
  if (all.length < 3) return { zones: null, dots: 0 }
  const areas = all.map(b => b.n).sort((a, b) => a - b)
  const med = areas[Math.floor(areas.length / 2)]
  const zones = dotsToBoxes(scores, misses, lc, med)
  const dots = Object.values(zones).reduce((a, z) => a + z.sc + z.ms, 0)
  return { zones, dots }
}

function toRGBA(img) {
  const { width: w, height: h, data, kind } = img
  if (kind === 3 || data.length === w * h * 4) return data
  const out = new Uint8ClampedArray(w * h * 4)
  if (kind === 2 || data.length === w * h * 3) {
    for (let p = 0, q = 0; p < w * h; p++) { out[q++] = data[p * 3]; out[q++] = data[p * 3 + 1]; out[q++] = data[p * 3 + 2]; out[q++] = 255 }
    return out
  }
  out.fill(255)
  return out
}

/* ---------- opponent shot-origin table (PDF text) ---------- */
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
function zoneToSlot(t) { t = t.toLowerCase(); if (t.startsWith('opp')) return 'def'; if (t.startsWith('team')) return 'att'; return 'mid' }
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
  if (!name) return { img: null, name: null }
  const img = await new Promise((resolve) => {
    let done = false
    const f = (o) => { if (!done) { done = true; resolve(o || null) } }
    try { page.objs.get(name, f) } catch { f(null) }
    setTimeout(() => f(null), 9000)
  })
  return { img, name }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { pdfBase64 } = req.body || {}
  if (!pdfBase64) return res.status(400).json({ error: 'Missing pdfBase64' })

  const debug = {}
  try {
    const data = new Uint8Array(Buffer.from(pdfBase64, 'base64'))
    const pdf = await pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise
    debug.pages = pdf.numPages

    let concedingPage = null, originRows = null
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const rows = textRows(await page.getTextContent())
      const text = rows.join(' ')
      if (!originRows && /opposition shots originated/i.test(text)) originRows = rows
      if (/Shots Conceded/i.test(text)) concedingPage = p
      else if (concedingPage == null && /Conceding/i.test(text)) concedingPage = p
    }
    debug.concedingPage = concedingPage

    const shot_origins = originRows ? extractShotOrigins(originRows) : null

    let shot_zones = null
    if (concedingPage != null) {
      const page = await pdf.getPage(concedingPage)
      const { img, name } = await readConcedingImage(page)
      debug.imageName = name
      debug.imageSize = img ? `${img.width}x${img.height} kind${img.kind}` : 'none'
      if (img && img.data && img.width > 50) {
        const rgba = toRGBA(img)
        const W = img.width, H = img.height
        const cutX = Math.round(W * 0.47)
        const r = readBoxesFromChart(rgba, W, H, { x0: 0, y0: 0, x1: cutX, y1: H }, Math.max(18, Math.round((W * H) / 15000)))
        if (r && r.zones) { shot_zones = r.zones; debug.dots = r.dots }
      }
    }

    return res.json({ shot_zones, shot_origins, debug })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e), debug })
  }
}

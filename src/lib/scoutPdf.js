// scoutPdf.js — pull the few PDF-only numbers (opponent shot origins by third)
// straight from the GAA Insights PDF in the browser, so the loader needs only
// the XML + PDF and nothing typed by hand.
//
// Robust by design: if the table can't be found (older/different PDF layout),
// it returns shot_origins: null and the loader falls back to manual entry.
//
// pdf.js is loaded lazily (dynamic import) so its ~370KB only downloads when a
// coach actually parses a PDF — it stays out of the main app bundle.

let _pdfjs = null
async function ensurePdfjs() {
  if (!_pdfjs) {
    const lib = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    lib.GlobalWorkerOptions.workerSrc = workerUrl
    _pdfjs = lib
  }
  return _pdfjs
}

// Rebuild text rows from positioned glyph runs: group by rounded y, sort by x.
function rowsFromTextContent(tc) {
  const byY = {}
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue
    const y = Math.round(it.transform[5])
    ;(byY[y] ||= []).push({ x: it.transform[4], s: it.str })
  }
  return Object.keys(byY).map(Number).sort((a, b) => b - a)
    .map(y => byY[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim())
}

// From the "where opposition shots originated from" table, sum the three source
// rows (Turnover / Opp KO / Team KO) into the opponent's attacking / middle /
// defensive third — i.e. where THEY win the ball before shooting.
//
// Column meaning (this is Ballyboden's report, so):
//   Opp_Third  -> the opponent's OWN third (deep) = their DEFENSIVE third
//   Team_Third -> Ballyboden's third (near our goal) = their ATTACKING third
//   Middle     -> middle third
// (so a side that wins it deep and counter-attacks is def-heavy.)
function zoneToSlot(tok) {
  const t = tok.toLowerCase()
  if (t.startsWith('opp')) return 'def'   // opponent's own third = deep/defensive
  if (t.startsWith('team')) return 'att'  // our third = their attacking end
  return 'mid'
}
function extractShotOrigins(rows) {
  const idx = rows.findIndex(r => /opposition shots originated/i.test(r))
  if (idx < 0) return null
  const window = rows.slice(idx, idx + 9)
  // Learn column order from the header (e.g. "... Opp_Third Middle Third Team Third").
  let order = ['def', 'mid', 'att'] // canonical GAA Insights order
  const headerLine = window.find(l => /Total/i.test(l) && /(Opp[_ ]?Third|Team[_ ]?Third)/i.test(l))
  if (headerLine) {
    const toks = []; const re = /(Opp[_ ]?Third|Team[_ ]?Third|Middle)/gi; let m
    while ((m = re.exec(headerLine))) toks.push(zoneToSlot(m[1]))
    if (toks.length === 3) order = toks
  }
  const grab = (lbl) => {
    const row = window.find(r => new RegExp('^' + lbl + '\\s+\\d', 'i').test(r))
    if (!row) return null
    const nums = (row.match(/\d+/g) || []).map(Number)
    return nums.length >= 4 ? nums.slice(1, 4) : null // drop Total, keep 3 thirds
  }
  const srcRows = ['Turnover', 'Opp(?:osition)? ?KO', 'Team ?KO'].map(grab).filter(Boolean)
  if (!srcRows.length) return null
  const acc = { att: 0, mid: 0, def: 0 }
  srcRows.forEach(r => r.forEach((v, i) => { acc[order[i]] += v }))
  const total = acc.att + acc.mid + acc.def
  // Sanity gate: a single game's opponent shots are ~12-40. If the parse is
  // wildly off (wrong table), return null so we DON'T auto-fill bad numbers.
  if (total < 5 || total > 60) return null
  return acc
}

export async function parseScoutPDF(arrayBuffer) {
  const out = { shot_origins: null, shot_zones: null, shot_zones_error: null }
  try {
    const pdfjsLib = await ensurePdfjs()
    const data = new Uint8Array(arrayBuffer)
    const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
    let concedingPage = null
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const tc = await page.getTextContent()
      const rows = rowsFromTextContent(tc)
      const text = rows.join('\n')
      // Opponent possession-origin table: "where opposition shots originated from".
      if (out.shot_origins == null && /opposition shots originated/i.test(text)) {
        out.shot_origins = extractShotOrigins(rows)
      }
      // The opposition shot chart is the "Conceding" page — identified by its
      // "Shots Conceded" heading (prefer that over a stray "Conceding" mention
      // elsewhere, e.g. a contents page). Fall back to any "Conceding" page.
      if (/Shots Conceded/i.test(text)) concedingPage = p
      else if (concedingPage == null && /Conceding/i.test(text)) concedingPage = p
    }
    if (concedingPage != null) {
      const z = await readShotZonesFromPage(pdf, concedingPage, pdfjsLib)
      out.shot_zones = z?.zones || null
      out.shot_zones_error = z?.error || null
    } else {
      out.shot_zones_error = 'no Conceding page found'
    }
  } catch (e) {
    // swallow — loader falls back to manual entry
    console.warn('Scout PDF parse failed:', e?.message)
  }
  return out
}

// Normalise a pdf.js decoded image {width,height,data,kind} to RGBA bytes.
// kind: 1 = grayscale-1bpp, 2 = RGB-24bpp, 3 = RGBA-32bpp.
function toRGBA(img) {
  const { width: w, height: h, data, kind } = img
  const out = new Uint8ClampedArray(w * h * 4)
  if (kind === 3 || data.length === w * h * 4) return data.length === w * h * 4 ? data : out
  if (kind === 2 || data.length === w * h * 3) {
    for (let p = 0, q = 0; p < w * h; p++) {
      out[q++] = data[p * 3]; out[q++] = data[p * 3 + 1]; out[q++] = data[p * 3 + 2]; out[q++] = 255
    }
    return out
  }
  // grayscale-1bpp (packed bits) — unlikely for a colour chart, fill white
  out.fill(255)
  return out
}

// Pull a decoded image out of pdf.js' object stores (objs or commonObjs).
function getImageObj(page, name) {
  return new Promise((resolve) => {
    let settled = false
    const done = (o) => { if (!settled) { settled = true; resolve(o || null) } }
    const stores = [page.objs, page.commonObjs].filter(Boolean)
    for (const s of stores) {
      try { if (s.has && s.has(name)) return done(s.get(name)) } catch { /* not ready */ }
    }
    try { page.objs.get(name, done) } catch {
      try { page.commonObjs.get(name, done) } catch { done(null) }
    }
    setTimeout(() => done(null), 12000) // safety timeout (callback fires during render)
  })
}

// Read the Conceding shot chart into GAA boxes. Primary path reads the EMBEDDED
// chart image directly (no canvas render — avoids every browser render quirk);
// falls back to rendering the page if the embedded image can't be fetched.
async function readShotZonesFromPage(pdf, pageNum, pdfjsLib) {
  const { readBoxesFromChart, readBoxesByCluster } = await import('./scoutShotChart')
  const OPS = pdfjsLib.OPS

  // --- locate the largest image XObject on the page (the shot-chart pair) ---
  let page, ops
  try {
    page = await pdf.getPage(pageNum)
    ops = await page.getOperatorList()
  } catch (e) {
    return { zones: null, error: 'page load failed: ' + (e?.message || e) }
  }
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; let best = null
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i]
    if (fn === OPS.save) stack.push(ctm.slice())
    else if (fn === OPS.restore) ctm = stack.pop() || ctm
    else if (fn === OPS.transform) ctm = mul(ctm, a)
    else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]])
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
      const r = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
      const area = (r.x1 - r.x0) * (r.y1 - r.y0)
      if (!best || area > best.area) best = { name: a[0], area, ...r }
    }
  }

  // Register the image-capture callback BEFORE rendering. pdf.js only decodes
  // the bitmap *during* render and (for large images) doesn't retain it after,
  // so we must be listening when it resolves — not ask for it afterwards.
  const imgPromise = best ? getImageObj(page, best.name) : Promise.resolve(null)

  // --- RENDER the page once (fires the callback above; also gives fallback px) ---
  let rendered = null
  try {
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport, background: '#ffffff' }).promise
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height)
    rendered = { data: im.data, width: canvas.width, height: canvas.height }
  } catch (e) { /* fall through */ }

  // --- PRIMARY: the embedded chart bitmap captured during render (correct frame) ---
  if (best) {
    try {
      const img = await imgPromise
      if (img && img.data && img.width > 50) {
        const data = toRGBA(img)
        const W = img.width, H = img.height
        // dot chart = LEFT ~47% of the pair image; heatmap = right (cropped off).
        const cutX = Math.round(W * 0.47)
        const r = readBoxesFromChart(data, W, H, { x0: 0, y0: 0, x1: cutX, y1: H }, Math.max(18, Math.round(W * H / 15000)))
        if (r && r.zones) return { zones: r.zones, dots: r.totals.sc + r.totals.ms }
      }
    } catch (e) { /* fall through to cluster */ }
  }

  // --- FALLBACK: cluster the dots straight off the rendered page (no bbox). ---
  if (rendered) {
    try {
      const r = readBoxesByCluster(rendered.data, rendered.width, rendered.height)
      if (r && r.zones) return { zones: r.zones, dots: r.dots }
      return { zones: null, error: r?.debug?.collapsed ? 'chart read unreliable for this report' : 'couldn\u2019t read the chart' }
    } catch (e) {
      return { zones: null, error: 'cluster failed: ' + (e?.message || e) }
    }
  }
  return { zones: null, error: 'render unavailable' }
}

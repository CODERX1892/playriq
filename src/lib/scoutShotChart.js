// scoutShotChart.js — read the opposition shot chart (the "Conceding" page),
// classify each dot by outcome colour, and map it to a GAA position box.
// Browser-agnostic core (works on raw RGBA) so it can be unit-tested; the
// pdf.js rendering + image-locating glue lives in scoutPdf.js.
//
// Outcome colours (from the GAA Insights legend):
//   Point  = blue,  Goal = yellow,  Two Points = orange  -> SCORE
//   Miss   = red                                          -> MISS
// (The page also has a frequency heatmap on the right — a dense colour block —
//  which we detect by column density and exclude.)
//
// Boxes: the pitch's 5 position lines x 3 channels. The chart shows only the
// attacking half, so shots land in the forward lines:
//   Full-forward 13/14/15 (nearest goal) · Half-forward 10/11/12 · Midfield 8/0/9
// Grid below is [band 0=FF (top/near goal) .. 2=MF][channel 0=L .. 2=R].
export const BOX_GRID = [[15, 14, 13], [12, 11, 10], [9, 0, 8]]
export const BOX_KEYS = BOX_GRID.flat().map(String)

const isMiss = (r, g, b) => r > 120 && r - g > 55 && r - b > 45 && g < 90  // red (not orange)
const isPoint = (r, g, b) => b > 110 && b - r > 40 && b - g > 30           // blue
const isGoal = (r, g, b) => r > 170 && g > 160 && b < 110 && Math.abs(r - g) < 60 // yellow
const is2pt = (r, g, b) => r > 185 && g > 95 && g < 170 && b < 85          // orange
const isScore = (r, g, b) => isPoint(r, g, b) || isGoal(r, g, b) || is2pt(r, g, b)
const anyColour = (r, g, b) => Math.abs(r - g) > 25 || Math.abs(g - b) > 25 || Math.abs(r - b) > 25

// Connected-component centroids (8-connectivity) for pixels passing `test`,
// within box {x0,y0,x1,y1}; keep blobs with area >= minSize.
function components(data, width, box, test, minSize, maxSize = 600) {
  const { x0, y0, x1, y1 } = box
  const bw = x1 - x0, bh = y1 - y0
  if (bw <= 0 || bh <= 0) return []
  const seen = new Uint8Array(bw * bh)
  const at = (lx, ly) => {
    const i = ((ly + y0) * width + (lx + x0)) * 4
    return test(data[i], data[i + 1], data[i + 2])
  }
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

// Within the chart image box, drop the dense frequency-heatmap block on the
// right and return just the left dot-chart sub-box.
export function leftChartBox(data, width, box) {
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
  // first column index (scanning L->R, past the left third) where density stays high = heatmap start
  let cut = bw
  for (let lx = Math.floor(bw * 0.35); lx < bw; lx++) {
    if (colFrac[lx] > 0.6) { cut = lx - Math.floor(bw * 0.02); break }
  }
  return { x0, y0, x1: x0 + Math.max(0, cut), y1 }
}

export function detectOutcomeDots(data, width, box, minSize = 30) {
  return {
    scores: components(data, width, box, isScore, minSize),
    misses: components(data, width, box, isMiss, minSize),
  }
}

const FREE_FILL = 0.68 // bbox-fill below this = diamond (free); above = circle (play)

// Map blobs to boxes. Overlapping dots show up as an oversized blob, so each
// blob expands to round(area / typical-single-dot-area) shots (>=1) — recovering
// a shot hidden behind another. Diamonds (low fill) are counted as frees.
export function dotsToBoxes(scores, misses, box, medianArea) {
  const { x0, y0, x1, y1 } = box
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0)
  const med = medianArea || 1
  const z = {}
  const place = (d, kind) => {
    const band = Math.min(2, Math.max(0, Math.floor(((d.y - y0) / h) * 3)))
    const ch = Math.min(2, Math.max(0, Math.floor(((d.x - x0) / w) * 3)))
    const k = String(BOX_GRID[band][ch])
    const n = Math.max(1, Math.round(d.n / med)) // overlap -> hidden shot(s)
    const cell = (z[k] ||= { sc: 0, ms: 0, fr: 0 })
    cell[kind] += n
    if (d.fill < FREE_FILL) cell.fr += n
  }
  scores.forEach(d => place(d, 'sc'))
  misses.forEach(d => place(d, 'ms'))
  return z
}

// Full pipeline given the chart image box: isolate dot chart, detect, map.
export function readBoxesFromChart(data, width, height, imageBox, minSize) {
  const lc = leftChartBox(data, width, imageBox)
  const { scores, misses } = detectOutcomeDots(data, width, lc, minSize)
  const all = scores.concat(misses)
  if (all.length < 3) {
    return { zones: null, debug: chartDebug(data, width, imageBox, lc) }
  }
  const areas = all.map(b => b.n).sort((a, b) => a - b)
  const medianArea = areas[Math.floor(areas.length / 2)]
  const zones = dotsToBoxes(scores, misses, lc, medianArea)
  const sc = Object.values(zones).reduce((a, z) => a + z.sc, 0)
  const ms = Object.values(zones).reduce((a, z) => a + z.ms, 0)
  const fr = Object.values(zones).reduce((a, z) => a + z.fr, 0)
  return { zones, box: lc, totals: { sc, ms, fr } }
}

// Bbox-free reader: detect every score/miss dot on the whole rendered page,
// split off the right-hand heatmap by the largest horizontal GAP between dot
// clusters (the dot chart sits left, the heatmap fragments right), then map the
// left cluster to boxes. The pitch frame is derived from the cluster: channels
// are centred on the dots (shots are ~symmetric about the goal) and the bands
// are stretched so the forward dots fill FF+HF and midfield stays ~empty.
export function readBoxesByCluster(data, width, height) {
  const region = { x0: 0, y0: 0, x1: width, y1: height }
  const minSize = Math.max(20, Math.round((width * height) / 90000))
  const scores = components(data, width, region, isScore, minSize)
  const misses = components(data, width, region, isMiss, minSize)
  const all = scores.map(b => ({ ...b, kind: 'sc' })).concat(misses.map(b => ({ ...b, kind: 'ms' })))
  if (all.length < 4) return { zones: null, debug: { n: all.length } }

  // largest horizontal gap => boundary between dot chart (left) and heatmap (right)
  const xs = all.map(b => b.x).sort((a, b) => a - b)
  let gap = -1, cutX = Infinity
  for (let i = 0; i < xs.length - 1; i++) {
    const g = xs[i + 1] - xs[i]
    if (g > gap) { gap = g; cutX = (xs[i] + xs[i + 1]) / 2 }
  }
  const left = all.filter(b => b.x < cutX)
  const right = all.filter(b => b.x >= cutX)
  // keep whichever side is the dot chart: the one with more dots (heatmap yields
  // fewer, larger fragments). Ties -> left, since the dot chart is drawn first.
  const cluster = right.length > left.length ? right : left
  if (cluster.length < 3) return { zones: null, debug: { n: all.length } }

  const cxs = cluster.map(b => b.x), cys = cluster.map(b => b.y)
  const xc = (Math.min(...cxs) + Math.max(...cxs)) / 2
  const halfW = ((Math.max(...cxs) - Math.min(...cxs)) / 2) / 0.62 // dots ~62% of pitch width
  const y0 = Math.min(...cys)
  const frame = { x0: xc - halfW, y0, x1: xc + halfW, y1: y0 + (Math.max(...cys) - y0) / 0.72 }

  const areas = cluster.map(b => b.n).sort((a, b) => a - b)
  const med = areas[Math.floor(areas.length / 2)] || 1
  const sc = cluster.filter(b => b.kind === 'sc')
  const ms = cluster.filter(b => b.kind === 'ms')
  const zones = dotsToBoxes(sc, ms, frame, med)
  const SC = Object.values(zones).reduce((a, z) => a + z.sc, 0)
  const MS = Object.values(zones).reduce((a, z) => a + z.ms, 0)
  const total = SC + MS
  // Confidence gate: a trustworthy read spreads across several boxes. If the
  // frame has collapsed and one box holds most of the dots, this is the unreliable
  // fallback misfiring (browser can't give us the real chart image) — return null
  // so the UI leaves the boxes blank for manual entry rather than dumping garbage.
  const maxBox = Math.max(0, ...Object.values(zones).map(z => z.sc + z.ms))
  if (total < 3 || maxBox / total > 0.5) {
    return { zones: null, debug: { collapsed: true, max: maxBox, total } }
  }
  return { zones, dots: total, totals: { sc: SC, ms: MS } }
}

// Count raw colour pixels in the full image vs the kept (left) region — lets a
// failed read report whether the issue is colour detection or the heatmap cut.
function chartDebug(data, width, imageBox, lc) {
  const countBox = (box, test) => {
    let n = 0
    for (let y = box.y0; y < box.y1; y += 2)
      for (let x = box.x0; x < box.x1; x += 2) {
        const i = (y * width + x) * 4
        if (test(data[i], data[i + 1], data[i + 2])) n++
      }
    return n
  }
  return {
    cutW: Math.round(lc.x1 - lc.x0),
    scoreFull: countBox(imageBox, isScore),
    missFull: countBox(imageBox, isMiss),
    scoreKept: countBox(lc, isScore),
  }
}

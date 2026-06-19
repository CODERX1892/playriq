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

// From the "Oppositions perspective" shot table, sum the three source rows into
// attacking / middle / defensive third totals.
//
// Orientation matters and is NOT assumed from column order: we read the header
// row to learn which column is which end, then map by name. From the opposition's
// perspective the labels mean:
//   Opp_Third  -> their ATTACKING end (the third nearest Ballyboden's goal)
//   Middle     -> middle third
//   Team_Third -> their OWN/DEFENSIVE end
// (Sanity: a team almost never shoots from its own defensive third, so def≈0.)
function zoneToSlot(tok) {
  const t = tok.toLowerCase()
  if (t.startsWith('opp')) return 'att'   // opponent's-opponent third = their attack
  if (t.startsWith('team')) return 'def'  // their own third = defensive
  return 'mid'
}
function extractShotOrigins(block) {
  // Learn column order from the header (e.g. "... Opp_Third Middle Third Team Third").
  let order = ['att', 'mid', 'def'] // canonical fallback
  const headerLine = block.split('\n').find(l =>
    /Total/i.test(l) && /(Opp[_ ]?Third|Team[_ ]?Third)/i.test(l))
  if (headerLine) {
    const toks = []
    const re = /(Opp[_ ]?Third|Team[_ ]?Third|Middle)/gi
    let m
    while ((m = re.exec(headerLine))) toks.push(zoneToSlot(m[1]))
    if (toks.length === 3) order = toks
  }
  const grab = (lbl) => {
    const m = block.match(new RegExp(lbl + '\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)'))
    return m ? m.slice(2).map(Number) : null // [z1,z2,z3] in header order (Total dropped)
  }
  const rows = ['Opp KO', 'Team KO', 'Turnover'].map(grab).filter(Boolean)
  if (!rows.length) return null
  const acc = { att: 0, mid: 0, def: 0 }
  rows.forEach(r => r.forEach((v, i) => { acc[order[i]] += v }))
  if (acc.att + acc.mid + acc.def === 0) return null
  return acc
}

export async function parseScoutPDF(arrayBuffer) {
  const out = { shot_origins: null }
  try {
    const pdfjsLib = await ensurePdfjs()
    const data = new Uint8Array(arrayBuffer)
    const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const tc = await page.getTextContent()
      const rows = rowsFromTextContent(tc)
      const text = rows.join('\n')
      // The opponent table sits under the "Oppositions perspective" note and
      // uses the "Opp KO" / "Team KO" source labels (the Boden table doesn't).
      if (/Oppositions/i.test(text) && /Opp KO/i.test(text)) {
        const idx = rows.findIndex(r => /Oppositions/i.test(r))
        const block = rows.slice(idx).join('\n')
        const so = extractShotOrigins(block)
        if (so) { out.shot_origins = so; break }
      }
    }
  } catch (e) {
    // swallow — loader falls back to manual entry
    console.warn('Scout PDF parse failed:', e?.message)
  }
  return out
}

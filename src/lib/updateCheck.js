// Auto-reload when a new build is deployed.
// PlayrIQ has no service worker, and iOS home-screen web apps cache the HTML
// shell without revalidating — so a fresh deploy can keep running old code
// (e.g. the Analytics intensity showing stale numbers). This polls index.html
// (no-store) and compares the hashed bundle name to the one currently running;
// on a mismatch it reloads once to pick up the new build.

function bundleHash(s) {
  const m = (s || '').match(/index-[A-Za-z0-9_-]+\.js/)
  return m ? m[0] : ''
}

const RUNNING = bundleHash(
  [...document.querySelectorAll('script[src]')]
    .map(el => el.getAttribute('src') || '')
    .find(src => /\/assets\/index-.*\.js/.test(src)) || ''
)

let reloading = false
async function checkForUpdate() {
  if (reloading || !RUNNING) return
  try {
    const html = await fetch('/index.html?_=' + Date.now(), { cache: 'no-store' }).then(r => r.text())
    const latest = bundleHash(html)
    if (latest && latest !== RUNNING) {
      // Guard against a reload loop if the shell is still being served stale.
      if (sessionStorage.getItem('pq_update_tried') === latest) return
      sessionStorage.setItem('pq_update_tried', latest)
      reloading = true
      window.location.reload()
    }
  } catch { /* offline or blocked — ignore */ }
}

export function startUpdateCheck() {
  window.addEventListener('focus', checkForUpdate)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate() })
  setInterval(checkForUpdate, 5 * 60 * 1000) // every 5 min while open
  checkForUpdate() // and once now, to self-heal a stale home-screen launch
}

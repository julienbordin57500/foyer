// Le logo de démarrage (dans index.html) s'efface une fois l'interface prête,
// mais jamais avant la fin de son animation (~1,1 s) : on la voit en entier, une seule fois.
const MIN_VISIBLE_MS = 1150
let hidden = false

export function hideSplash() {
  if (hidden) return
  hidden = true
  const el = document.getElementById('splash')
  if (!el) return
  setTimeout(() => {
    el.classList.add('out')
    setTimeout(() => el.remove(), 500)
  }, Math.max(0, MIN_VISIBLE_MS - performance.now()))
}

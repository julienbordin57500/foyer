import { useEffect, useState } from 'react'

export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'foyer-theme'

const COLORS = { light: '#f5f3f0', dark: '#0e0e10' }

export function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    /* stockage indisponible */
  }
  // Nuit par défaut : le design est pensé d'abord pour le sombre.
  return 'dark'
}

/** Pose data-theme sur <html> et accorde la barre d'état du téléphone. */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'auto') delete root.dataset.theme
  else root.dataset.theme = pref
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (pref === 'auto') m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? COLORS.dark : COLORS.light)
    else m.setAttribute('content', dark ? COLORS.dark : COLORS.light)
  })
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readTheme)
  useEffect(() => {
    applyTheme(pref)
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* ignoré */
    }
  }, [pref])
  return [pref, setPref] as const
}

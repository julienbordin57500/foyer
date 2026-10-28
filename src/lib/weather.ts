import { useEffect, useState } from 'react'

// Météo de Saint-Avold (57500) via Open-Meteo : gratuit, sans compte ni clé.
const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=49.104&longitude=6.707' +
  '&current=temperature_2m,weather_code&hourly=precipitation_probability' +
  '&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=1'
const CACHE_KEY = 'foyer-meteo'
const FRESH_MS = 30 * 60_000

export type Weather = { emoji: string; label: string; temp: number; min: number; max: number; rainAt: number | null }

type Raw = {
  current: { temperature_2m: number; weather_code: number }
  hourly: { time: string[]; precipitation_probability: number[] }
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] }
}

/** Codes météo (WMO) → emoji et mot simple. La nuit, le soleil devient une lune. */
function describe(code: number, night: boolean): [string, string] {
  if (code === 0) return night ? ['🌙', 'dégagé'] : ['☀️', 'soleil']
  if (code <= 2) return night ? ['☁️', 'peu nuageux'] : ['🌤️', 'éclaircies']
  if (code === 3) return ['☁️', 'couvert']
  if (code <= 48) return ['🌫️', 'brouillard']
  if (code <= 57) return ['🌦️', 'bruine']
  if (code <= 67 || (code >= 80 && code <= 82)) return ['🌧️', 'pluie']
  if (code <= 77 || code === 85 || code === 86) return ['❄️', 'neige']
  return ['⛈️', 'orage']
}

function parse(raw: Raw): Weather {
  const hour = new Date().getHours()
  const [emoji, label] = describe(raw.current.weather_code, hour >= 20 || hour < 7)
  // Prochaine heure de la journée où la pluie est probable (au moins 1 chance sur 2).
  const rainAt =
    raw.hourly.time
      .map((t, i) => ({ h: Number(t.slice(11, 13)), p: raw.hourly.precipitation_probability[i] }))
      .find((x) => x.h > hour && x.p >= 50)?.h ?? null
  return {
    emoji,
    label,
    temp: Math.round(raw.current.temperature_2m),
    min: Math.round(raw.daily.temperature_2m_min[0]),
    max: Math.round(raw.daily.temperature_2m_max[0]),
    rainAt,
  }
}

function readCache(): { at: number; raw: Raw } | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
  } catch {
    return null
  }
}

/** La météo du moment, gardée 30 minutes. Rien ne s'affiche si le réseau ou le service ne répond pas. */
export function useWeather() {
  const [raw, setRaw] = useState<Raw | null>(() => readCache()?.raw ?? null)
  useEffect(() => {
    const cached = readCache()
    if (cached && Date.now() - cached.at < FRESH_MS) return
    const ctrl = new AbortController()
    fetch(URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: Raw) => {
        setRaw(r)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), raw: r }))
        } catch {
          /* pas de cache : on redemandera */
        }
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  try {
    return raw ? parse(raw) : null
  } catch {
    return null
  }
}

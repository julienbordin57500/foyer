import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sans configuration Supabase, l'app tourne en mode démo (données locales au navigateur). */
export const supabase = url && key ? createClient(url, key) : null
export const isDemo = !supabase

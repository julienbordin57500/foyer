import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Home, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Household, Member } from '../lib/types'
import { demoBackend, supabaseBackend, type Backend } from '../data/backends'
import { DataProvider } from '../data/store'
import { Button, Field, cx } from '../components/ui'

interface Session_ {
  me: Member
  household: Household
  members: Member[]
  demo: boolean
  signOut(): void
}

const Ctx = createContext<Session_ | null>(null)
export const useSession = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession hors de AuthGate')
  return s
}

const DEMO: Omit<Session_, 'signOut'> = {
  me: { user_id: 'demo', display_name: 'Vous' },
  household: { id: 'demo', name: 'Foyer démo', invite_code: 'DEMO42' },
  members: [
    { user_id: 'demo', display_name: 'Vous' },
    { user_id: 'demo-2', display_name: 'Votre moitié' },
  ],
  demo: true,
}

export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabase) return <DemoGate>{children}</DemoGate>
  return <SupabaseGate>{children}</SupabaseGate>
}

function DemoGate({ children }: { children: ReactNode }) {
  const backend = useMemo(demoBackend, [])
  const value = useMemo(
    () => ({
      ...DEMO,
      signOut: () => {
        localStorage.removeItem('foyer-demo-v1')
        location.reload()
      },
    }),
    [],
  )
  return (
    <Ctx.Provider value={value}>
      <DataProvider backend={backend}>{children}</DataProvider>
    </Ctx.Provider>
  )
}

function SupabaseGate({ children }: { children: ReactNode }) {
  const sb = supabase!
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<{ me: Member; household: Household; members: Member[] } | null | undefined>(undefined)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [sb])

  const loadProfile = useCallback(async () => {
    if (!session) return setProfile(undefined)
    const { data: me } = await sb.from('members').select('user_id, display_name, household_id').eq('user_id', session.user.id).maybeSingle()
    if (!me) return setProfile(null)
    const [{ data: household }, { data: members }] = await Promise.all([
      sb.from('households').select('id, name, invite_code').eq('id', me.household_id).single(),
      sb.from('members').select('user_id, display_name').eq('household_id', me.household_id).order('created_at'),
    ])
    setProfile({ me, household: household!, members: members ?? [] })
  }, [sb, session])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const backend = useMemo<Backend | null>(() => (profile ? supabaseBackend(sb, profile.household.id) : null), [sb, profile])

  if (session === undefined || (session && profile === undefined)) return <Splash />
  if (!session) return <Login />
  if (!profile || !backend) return <SetupHousehold onDone={loadProfile} />

  return (
    <Ctx.Provider value={{ ...profile, demo: false, signOut: () => sb.auth.signOut() }}>
      <DataProvider backend={backend}>{children}</DataProvider>
    </Ctx.Provider>
  )
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center text-muted">
      <Loader2 className="animate-spin" />
    </div>
  )
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-lg shadow-accent/30">
          <Home size={26} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

const Message = ({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) => (
  <p className={cx('rounded-2xl px-4 py-3 text-sm', tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent')}>{children}</p>
)

const translateAuthError = (msg: string) => {
  if (/invalid login/i.test(msg)) return 'E-mail ou mot de passe incorrect.'
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet e-mail.'
  if (/password should be/i.test(msg)) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (/email not confirmed/i.test(msg)) return "Confirmez d'abord votre e-mail (lien reçu par mail)."
  return msg
}

function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const res =
      mode === 'in'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password })
    setBusy(false)
    if (res.error) return setError(translateAuthError(res.error.message))
    if (mode === 'up' && !res.data.session) setInfo('Compte créé. Ouvrez le lien de confirmation reçu par e-mail, puis connectez-vous.')
  }

  return (
    <AuthShell title="Foyer" subtitle="Courses, abonnements et budget, à deux.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Message tone="error">{error}</Message>}
        {info && <Message tone="info">{info}</Message>}
        <Button className="w-full" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === 'in' ? 'Se connecter' : 'Créer mon compte'}
        </Button>
      </form>
      <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="mt-6 text-sm font-medium text-accent">
        {mode === 'in' ? 'Pas encore de compte ? Créer un compte' : "J'ai déjà un compte"}
      </button>
    </AuthShell>
  )
}

function SetupHousehold({ onDone }: { onDone(): void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } =
      mode === 'create'
        ? await supabase!.rpc('create_household', { p_name: householdName, p_display_name: name })
        : await supabase!.rpc('join_household', { p_code: code, p_display_name: name })
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <AuthShell title="Bienvenue" subtitle="Créez votre foyer, ou rejoignez celui de votre conjoint avec son code.">
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-surface-2 p-1 text-sm font-semibold">
        {(['create', 'join'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cx('h-10 rounded-xl transition', mode === m ? 'bg-surface text-ink shadow-sm' : 'text-muted')}
          >
            {m === 'create' ? 'Créer' : 'Rejoindre'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Votre prénom" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        {mode === 'create' ? (
          <Field label="Nom du foyer" placeholder="Notre foyer" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
        ) : (
          <Field
            label="Code d'invitation"
            hint="Visible dans les réglages de l'app de votre conjoint."
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] font-semibold uppercase tracking-[0.3em] outline-none ring-accent focus:ring-2"
            maxLength={6}
          />
        )}
        {error && <Message tone="error">{error}</Message>}
        <Button className="w-full" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === 'create' ? 'Créer le foyer' : 'Rejoindre le foyer'}
        </Button>
      </form>
      <button onClick={() => supabase!.auth.signOut()} className="mt-6 text-sm font-medium text-muted">
        Se déconnecter
      </button>
    </AuthShell>
  )
}

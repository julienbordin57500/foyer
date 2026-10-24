import { useState } from 'react'
import { Check, Copy, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useSession } from '../auth/AuthGate'
import { useTheme, type ThemePref } from '../lib/theme'
import { Avatar, Button, Segmented, Sheet } from './ui'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { household, members, me, demo, signOut } = useSession()
  const [theme, setTheme] = useTheme()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <Sheet open={open} title="Réglages" onClose={onClose}>
      {demo && (
        <p className="mb-5 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Mode démo : les données restent dans ce navigateur.
        </p>
      )}

      <p className="mb-2 px-1 text-[13px] font-medium text-muted">Apparence</p>
      <Segmented<ThemePref>
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun size={15} /> Jour</span> },
          { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon size={15} /> Nuit</span> },
          { value: 'auto', label: <span className="inline-flex items-center gap-1.5"><Monitor size={15} /> Auto</span> },
        ]}
      />
      <p className="mb-6 mt-1.5 px-1 text-xs text-muted">« Auto » suit le réglage du téléphone.</p>

      <p className="mb-2 px-1 text-[13px] font-medium text-muted">{household.name}</p>
      <ul className="mb-6 divide-y divide-line rounded-2xl bg-surface-2 px-4">
        {members.map((m, i) => (
          <li key={m.user_id} className="flex h-14 items-center gap-3">
            <Avatar initial={m.display_name.slice(0, 1).toUpperCase()} tone={i === 1 ? 'b' : 'a'} size="sm" />
            <span className="flex-1 font-medium">{m.display_name}</span>
            {m.user_id === me.user_id && <span className="text-[13px] text-muted">vous</span>}
          </li>
        ))}
      </ul>

      {members.length < 2 && (
        <>
          <p className="mb-2 px-1 text-[13px] font-medium text-muted">Code d'invitation</p>
          <button onClick={copy} className="mb-2 flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="num text-2xl font-bold tracking-[0.3em]">{household.invite_code}</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copié' : 'Copier'}
            </span>
          </button>
          <p className="mb-6 px-1 text-xs text-muted">Dans l'app, choisir « Rejoindre » et saisir ce code.</p>
        </>
      )}

      <Button variant="secondary" className="w-full" onClick={signOut}>
        <LogOut size={18} />
        {demo ? 'Réinitialiser la démo' : 'Se déconnecter'}
      </Button>
    </Sheet>
  )
}

import { useState } from 'react'
import { Check, Copy, LogOut } from 'lucide-react'
import { useSession } from '../auth/AuthGate'
import { Avatar, Button, Sheet } from './ui'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { household, members, me, demo, signOut } = useSession()
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
    <Sheet open={open} title={household.name} onClose={onClose}>
      {demo && (
        <p className="mb-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Mode démo : les données restent dans ce navigateur. Configurez Supabase pour partager le foyer entre deux téléphones.
        </p>
      )}

      <p className="mb-2 px-1 text-sm font-medium text-muted">Membres</p>
      <ul className="mb-5 divide-y divide-line rounded-2xl bg-surface-2 px-4">
        {members.map((m, i) => (
          <li key={m.user_id} className="flex items-center gap-3 py-3">
            <Avatar initial={m.display_name.slice(0, 1).toUpperCase()} tone={i === 1 ? 'b' : 'a'} size="md" />
            <span className="flex-1 font-medium">{m.display_name}</span>
            {m.user_id === me.user_id && <span className="text-[13px] text-muted">vous</span>}
          </li>
        ))}
      </ul>

      {members.length < 2 && (
        <>
          <p className="mb-2 px-1 text-sm font-medium text-muted">Inviter votre conjoint</p>
          <button onClick={copy} className="mb-2 flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="num text-2xl font-bold tracking-[0.3em]">{household.invite_code}</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copié' : 'Copier'}
            </span>
          </button>
          <p className="mb-5 px-1 text-xs text-muted">
            Votre conjoint crée son compte dans l'app, choisit « Rejoindre » et saisit ce code.
          </p>
        </>
      )}

      <Button variant="secondary" className="w-full" onClick={signOut}>
        <LogOut size={18} />
        {demo ? 'Réinitialiser la démo' : 'Se déconnecter'}
      </Button>
    </Sheet>
  )
}

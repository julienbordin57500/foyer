import { useState } from 'react'
import { Link2, Lock, RefreshCw, Trash2, Users } from 'lucide-react'
import { usePartner } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { supabase } from '../lib/supabase'
import { FEED_COLORS } from '../lib/agenda'
import { Button, cx } from './ui'

type Result = { name: string; imported?: number; removed?: number; error?: string }

/** Va chercher les calendriers de l'iPhone (serveur foyer-ical) et résume ce qui a été fait. */
export function useIphoneImport() {
  const { showToast } = useStore()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!supabase || busy) return
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ results: Result[] }>('foyer-ical', { body: {} })
      if (error) throw error
      const results = data?.results ?? []
      const failed = results.find((r) => r.error)
      const total = results.reduce((n, r) => n + (r.imported ?? 0), 0)
      showToast(
        failed ? `${failed.name} : ${failed.error}` : `📱 ${total} événement${total > 1 ? 's' : ''} à jour depuis l'iPhone`,
        () => {},
      )
    } catch {
      showToast("Import impossible pour l'instant, réessayez plus tard.", () => {})
    } finally {
      setBusy(false)
    }
  }
  return { run, busy }
}

/** Réglages : les calendriers de l'iPhone à importer, chacun « Juste moi » ou « Nous deux ». */
export function IphoneCalendars() {
  const { data, insert, update, remove } = useStore()
  const { run, busy } = useIphoneImport()
  const partner = usePartner()?.display_name ?? "l'autre"
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const nextColor = FEED_COLORS.find((c) => !data.calendar_feeds.some((f) => f.color === c)) ?? FEED_COLORS[0]
  const [color, setColor] = useState(nextColor)
  const valid = /^(webcal|https):\/\/[a-z0-9.-]+\.icloud\.com\//i.test(url.trim())

  const add = () => {
    if (!name.trim() || !valid) return
    insert('calendar_feeds', { name: name.trim().slice(0, 40), url: url.trim(), private: secret, color })
    setName('')
    setUrl('')
    setAdding(false)
  }
  // La base recopie couleur et visibilité sur les événements du calendrier ; en démo, on le fait ici.
  const change = (id: string, patch: { color?: string; private?: boolean }) => {
    update('calendar_feeds', id, patch)
    if (!supabase) data.calendar_events.filter((e) => e.feed_id === id).forEach((e) => update('calendar_events', e.id, patch))
  }

  return (
    <div className="mb-6">
      <p className="mb-2 px-1 text-[13px] font-medium text-muted">Calendriers de l'iPhone</p>
      {data.calendar_feeds.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-2xl bg-surface-2 px-4">
          {data.calendar_feeds.map((f) => {
            const open = editing === f.id
            return (
              <li key={f.id} className="py-2">
                <button
                  onClick={() => {
                    setEditing(open ? null : f.id)
                    setConfirm(false)
                  }}
                  className="flex min-h-10 w-full items-center gap-3 text-left"
                >
                  <span className="size-3.5 shrink-0 rounded-full" style={{ background: f.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="flex items-center gap-1 text-[12px] text-muted">
                      {f.private ? <Lock size={11} /> : <Users size={11} />}
                      {f.private ? 'Juste moi' : 'Nous deux'}
                      {f.synced_at &&
                        ` · importé le ${new Date(f.synced_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                    </span>
                  </span>
                  <span className="text-[13px] font-semibold text-sec">{open ? 'Fermer' : 'Modifier'}</span>
                </button>
                {open && (
                  <div className="flex animate-fade flex-col items-center gap-3 pb-1 pt-3">
                    <ColorChips value={f.color} onChange={(c) => change(f.id, { color: c })} />
                    <Visibility value={f.private} onChange={(p) => change(f.id, { private: p })} />
                    {confirm ? (
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-[13px] text-muted">Retirer « {f.name} » et ses événements de Foyer ?</p>
                        <div className="flex gap-2">
                          <button onClick={() => remove('calendar_feeds', f.id)} className="h-9 px-3 text-[14px] font-semibold text-late">
                            Oui, retirer
                          </button>
                          <button onClick={() => setConfirm(false)} className="h-9 px-3 text-[14px] font-semibold text-muted">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirm(true)}
                        className="flex h-9 items-center gap-1.5 px-3 text-[14px] font-semibold text-late"
                      >
                        <Trash2 size={15} /> Retirer ce calendrier
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2/60 p-3 ring-1 ring-line/50">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Nom : Perso, Famille…"
            aria-label="Nom du calendrier"
            className="h-12 rounded-xl bg-surface px-4 text-[15px] outline-none ring-1 ring-line/60 placeholder:text-faint focus:ring-2 focus:ring-sec/50"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Lien webcal://…icloud.com/…"
            aria-label="Lien du calendrier public iCloud"
            className="h-12 rounded-xl bg-surface px-4 text-[14px] outline-none ring-1 ring-line/60 placeholder:text-faint focus:ring-2 focus:ring-sec/50"
          />
          {url.trim() && !valid && <p className="px-1 text-[12px] text-late">Ce lien doit venir d'iCloud (webcal://…icloud.com/…).</p>}
          <div className="flex flex-col items-center gap-3 py-1">
            <ColorChips value={color} onChange={setColor} />
            <Visibility value={secret} onChange={setSecret} />
          </div>
          <Button onClick={add} disabled={!name.trim() || !valid}>
            Ajouter ce calendrier
          </Button>
          <button onClick={() => setAdding(false)} className="h-10 text-[14px] font-semibold text-muted">
            Annuler
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.calendar_feeds.length > 0 && (
            <Button onClick={run} disabled={busy || !supabase}>
              <RefreshCw size={17} className={cx(busy && 'animate-spin')} /> {busy ? 'Import en cours…' : "Importer de l'iPhone"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Link2 size={17} /> Ajouter un calendrier
          </Button>
        </div>
      )}
      <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted">
        {supabase
          ? `Le lien reste privé : seul vous le voyez. « Juste moi » : ${partner} ne voit pas ces événements.`
          : "Mode démo : l'import marche seulement dans la vraie app."}
      </p>
    </div>
  )
}

export function ColorChips({ value, onChange }: { value: string; onChange(c: string): void }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Couleur des pastilles">
      {FEED_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Couleur ${c}`}
          onClick={() => onChange(c)}
          className={cx(
            'size-7 rounded-full transition active:scale-90',
            value === c && 'ring-2 ring-ink ring-offset-2 ring-offset-surface-2',
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

function Visibility({ value, onChange }: { value: boolean; onChange(p: boolean): void }) {
  return (
    <div className="flex justify-center gap-1.5">
      {(
        [
          [true, '🔒 Juste moi'],
          [false, '👥 Nous deux'],
        ] as const
      ).map(([p, label]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={cx(
            'h-9 rounded-full px-3.5 text-[14px] font-semibold transition active:scale-95',
            value === p ? 'bg-ink text-bg' : 'bg-surface text-muted ring-1 ring-line/60',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

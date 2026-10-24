import { useState, type FormEvent } from 'react'
import { AlarmClock, Plus, Repeat, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { deadlineInfo } from '../lib/finance'
import { nextDebitDate } from '../lib/dates'
import { ddmm, ddmmyyyy, money, parseAmount, relativeDays } from '../lib/format'
import { parseISODate } from '../lib/dates'
import type { Subscription } from '../lib/types'
import { Badge, Button, Card, Empty, Field, IconButton, PageHeader, Sheet, cx } from '../components/ui'

type Editing = Subscription | 'new' | null

export default function SubscriptionsPage() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Editing>(null)
  const subs = data.subscriptions
  const total = subs.reduce((s, x) => s + x.amount, 0)

  // Échéances proches d'abord, puis par jour de prélèvement.
  const sorted = [...subs].sort((a, b) => {
    const da = deadlineInfo(a)
    const db = deadlineInfo(b)
    const ra = da && da.tone && da.tone !== 'past' ? da.days : Infinity
    const rb = db && db.tone && db.tone !== 'past' ? db.days : Infinity
    return ra - rb || a.debit_day - b.debit_day
  })

  return (
    <>
      <PageHeader
        title="Abonnements"
        subtitle={`${subs.length} abonnement${subs.length > 1 ? 's' : ''}`}
        action={
          <IconButton label="Ajouter un abonnement" onClick={() => setEditing('new')}>
            <Plus size={22} />
          </IconButton>
        }
      />

      <Card className="mb-4 flex items-end justify-between bg-accent-soft ring-0">
        <div>
          <p className="text-sm font-medium text-accent">Total mensuel</p>
          <p className="num text-4xl font-bold tracking-tight">{money(total)}</p>
        </div>
        <p className="num pb-1 text-right text-sm text-muted">
          soit {money(total * 12)}
          <br />
          par an
        </p>
      </Card>

      {subs.length === 0 ? (
        <Empty icon={<Repeat />} title="Aucun abonnement" text="Ajoutez vos abonnements pour suivre leur coût et leurs dates de résiliation." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => {
            const dl = deadlineInfo(s)
            const action = dl?.tone === 'urgent' || dl?.tone === 'soon'
            return (
              <li key={s.id}>
                <button
                  onClick={() => setEditing(s)}
                  className={cx(
                    'w-full rounded-3xl p-4 text-left ring-1 active:scale-[0.99]',
                    dl?.tone === 'urgent' ? 'bg-danger-soft ring-danger-line' : dl?.tone === 'soon' ? 'bg-warn-soft ring-warn-line' : 'bg-surface ring-line',
                  )}
                >
                  <span className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{s.name}</span>
                      <span className="block text-sm text-muted">
                        Le {s.debit_day} du mois · prochain {ddmm(nextDebitDate(s.debit_day))}
                      </span>
                    </span>
                    <span className="num text-[17px] font-bold">{money(s.amount)}</span>
                  </span>
                  {dl && (
                    <span className="mt-3 flex">
                      {action ? (
                        <Badge tone={dl.tone === 'urgent' ? 'danger' : 'warn'} className="bg-surface!">
                          <AlarmClock size={13} />
                          Résilier avant le {ddmm(dl.date)} · {relativeDays(dl.days)}
                        </Badge>
                      ) : (
                        <Badge>
                          {dl.tone === 'past' ? `Échéance passée (${ddmm(dl.date)})` : `Résiliable jusqu'au ${ddmmyyyy(dl.date)}`}
                        </Badge>
                      )}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={editing !== null} title={editing === 'new' ? 'Nouvel abonnement' : 'Modifier'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <SubscriptionForm key={editing === 'new' ? 'new' : editing.id} sub={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
        )}
      </Sheet>
    </>
  )
}

function SubscriptionForm({ sub, onClose }: { sub: Subscription | null; onClose(): void }) {
  const { insert, update, remove } = useStore()
  const [name, setName] = useState(sub?.name ?? '')
  const [amount, setAmount] = useState(sub ? String(sub.amount).replace('.', ',') : '')
  const [day, setDay] = useState(sub ? String(sub.debit_day) : '')
  const [deadline, setDeadline] = useState(sub?.cancel_deadline ?? '')
  const [err, setErr] = useState<string | null>(null)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const a = parseAmount(amount)
    const d = parseInt(day)
    if (!name.trim()) return setErr('Indiquez un nom.')
    if (!(a >= 0)) return setErr('Montant invalide.')
    if (!(d >= 1 && d <= 31)) return setErr('Le jour de prélèvement doit être entre 1 et 31.')
    const row = { name: name.trim(), amount: Math.round(a * 100) / 100, debit_day: d, cancel_deadline: deadline || null }
    if (sub) update('subscriptions', sub.id, row)
    else insert('subscriptions', row)
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Nom" placeholder="Netflix, box internet…" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!sub} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant mensuel (€)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="Jour de prélèvement" type="number" inputMode="numeric" min={1} max={31} placeholder="1 à 31" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <div>
        <Field
          label="Date limite de résiliation (optionnelle)"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          hint={deadline ? `Rappel affiché à partir du ${ddmm(new Date(parseISODate(deadline).getTime() - 60 * 86_400_000))}.` : 'Un rappel apparaît 60 jours avant.'}
        />
        {deadline && (
          <button type="button" onClick={() => setDeadline('')} className="mt-1 px-1 text-xs font-medium text-accent">
            Retirer la date
          </button>
        )}
      </div>
      {err && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{err}</p>}
      <div className="flex gap-3 pt-2">
        {sub && (
          <Button
            type="button"
            variant="danger"
            aria-label="Supprimer"
            className="px-4"
            onClick={() => {
              if (confirm(`Supprimer « ${sub.name} » ?`)) {
                remove('subscriptions', sub.id)
                onClose()
              }
            }}
          >
            <Trash2 size={18} />
          </Button>
        )}
        <Button className="flex-1">{sub ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </form>
  )
}

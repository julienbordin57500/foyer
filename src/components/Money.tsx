import { useState, type FormEvent } from 'react'
import { Euro, LayoutGrid, Plus, Repeat as RepeatIcon } from 'lucide-react'
import { useStore } from '../data/store'
import { capitalize, euros, parseAmount } from '../lib/format'
import { CHARGE_CATEGORIES, type Charge, type ChargeCategory, type Every } from '../lib/types'
import { Card, OptionRow, SectionTitle, Sheet, SheetActions, TitleInput, cx } from './ui'

// La couleur suit la catégorie (jamais son rang) : un filtre ne repeint pas les autres.
const COLOR = Object.fromEntries(CHARGE_CATEGORIES.map((c, i) => [c.id, `var(--cat-${i + 1})`])) as Record<ChargeCategory, string>
const EMOJI = Object.fromEntries(CHARGE_CATEGORIES.map((c) => [c.id, c.emoji])) as Record<ChargeCategory, string>

export const EVERY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'Tous les mois' },
  { value: '2', label: 'Tous les 2 mois' },
  { value: '3', label: 'Tous les 3 mois' },
  { value: '6', label: 'Tous les 6 mois' },
  { value: '12', label: 'Une fois par an' },
]
const everyText = (n: Every) => (n === 1 ? 'chaque mois' : n === 12 ? 'chaque année' : `tous les ${n} mois`)

/** Coût ramené au mois : 62 € tous les 2 mois → 31 €/mois. */
const monthly = (c: Charge) => c.amount / c.every_months

/** Charges fixes : total par mois, répartition par catégorie, et la liste avec sa petite ligne d'ajout. */
export function ChargesSection() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Charge | 'new' | null>(null)
  const [active, setActive] = useState<ChargeCategory | null>(null)
  const charges = [...data.charges].sort((a, b) => monthly(b) - monthly(a))
  const total = charges.reduce((s, c) => s + monthly(c), 0)

  const groups = CHARGE_CATEGORIES.map((c) => ({
    ...c,
    total: charges.filter((x) => x.category === c.id).reduce((s, x) => s + monthly(x), 0),
  }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
  const pct = (n: number) => (total ? (n / total) * 100 : 0)
  const shown = active ? groups.find((g) => g.id === active) : null

  return (
    <>
      <SectionTitle aside={charges.length ? `≈ ${euros(total)} / mois` : undefined}>Charges fixes</SectionTitle>
      <Card className="overflow-hidden">
        {charges.length > 0 && (
          <div className="border-b border-line/60 px-4 pb-4 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">{shown ? `${shown.emoji} ${shown.id}` : 'Par mois, en moyenne'}</span>
              <span className="num font-serif text-[22px] font-medium">{euros(shown ? shown.total : total)}</span>
            </div>
            {/* Barre empilée : 2 px d'écart entre les parts, une part par catégorie */}
            <div
              className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full"
              role="img"
              aria-label="Répartition des charges par catégorie"
            >
              {groups.map((g) => (
                <button
                  key={g.id}
                  title={`${g.id} : ${euros(g.total)} par mois`}
                  aria-label={`${g.id} : ${euros(g.total)} par mois`}
                  onClick={() => setActive(active === g.id ? null : g.id)}
                  className="h-full min-w-[4px] transition-opacity duration-300"
                  style={{ width: `${pct(g.total)}%`, background: COLOR[g.id], opacity: active && active !== g.id ? 0.25 : 1 }}
                />
              ))}
            </div>
            {/* Légende-tableau : le nom et le montant sont toujours écrits, la couleur n'est jamais seule */}
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setActive(active === g.id ? null : g.id)}
                    className={cx(
                      'flex w-full items-center gap-2 text-left text-[13px] transition-opacity',
                      active && active !== g.id && 'opacity-40',
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: COLOR[g.id] }} />
                    <span className="min-w-0 flex-1 truncate">{g.id}</span>
                    <span className="num text-muted">{Math.round(pct(g.total))} %</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul>
          {charges.map((c) => (
            <li key={c.id} className="border-b border-line/60">
              <button
                onClick={() => setEditing(c)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-[17px]">{EMOJI[c.category]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{c.label}</span>
                  <span className="block text-[12px] text-muted">
                    {euros(c.amount)} {everyText(c.every_months)}
                  </span>
                </span>
                <span className="num text-right text-[15px] font-semibold">
                  {euros(monthly(c))}
                  <span className="block text-[11px] font-normal text-muted">/ mois</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => setEditing('new')}
              className="flex h-12 w-full items-center justify-center gap-2 text-[14px] font-semibold text-sec active:bg-surface-2"
            >
              <Plus size={17} strokeWidth={2.6} /> Ajouter une charge
            </button>
          </li>
        </ul>
      </Card>

      <Sheet open={editing !== null} title={editing === 'new' ? 'Nouvelle charge' : 'Charge'} onClose={() => setEditing(null)}>
        {editing && (
          <ChargeForm
            key={editing === 'new' ? 'new' : editing.id}
            charge={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  )
}

function ChargeForm({ charge, onClose }: { charge: Charge | null; onClose(): void }) {
  const { insert, update, remove } = useStore()
  const [label, setLabel] = useState(charge?.label ?? '')
  const [amount, setAmount] = useState(charge ? String(charge.amount).replace('.', ',') : '')
  const [category, setCategory] = useState<ChargeCategory>(charge?.category ?? 'Logement')
  const [every, setEvery] = useState(String(charge?.every_months ?? 1))
  const [err, setErr] = useState<string | null>(null)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const a = parseAmount(amount)
    if (!label.trim()) return setErr('Indiquez de quelle charge il s’agit.')
    if (!(a >= 0)) return setErr('Montant invalide.')
    const row = { label: capitalize(label.trim()), amount: a, category, every_months: Number(every) as Every }
    if (charge) update('charges', charge.id, row)
    else insert('charges', row)
    onClose()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <TitleInput
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Loyer, électricité, crédit…"
        aria-label="Charge"
        autoFocus={!charge}
      />
      <label className="flex h-16 items-center gap-3 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
        <Euro size={18} className="text-sec" />
        <span className="flex-1 text-[15px] text-muted">Montant</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="num w-32 bg-transparent text-right font-serif text-[26px] font-medium outline-none placeholder:text-faint"
        />
        <span className="font-serif text-[22px] text-muted">€</span>
      </label>
      <OptionRow label="Fréquence" icon={<RepeatIcon size={18} />} value={every} onChange={setEvery} options={EVERY_OPTIONS} />
      <OptionRow<ChargeCategory>
        label="Catégorie"
        icon={<LayoutGrid size={18} />}
        value={category}
        onChange={setCategory}
        options={CHARGE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji}  ${c.id}` }))}
      />
      {err && <p className="text-center text-[14px] text-late">{err}</p>}
      <SheetActions
        saveLabel={charge ? 'Enregistrer' : 'Ajouter la charge'}
        deleteLabel="Supprimer la charge"
        onDelete={
          charge
            ? () => {
                remove('charges', charge.id)
                onClose()
              }
            : undefined
        }
      />
    </form>
  )
}

/** Récap des 6 derniers mois : total des factures payées chaque mois. */
export function MonthsRecap() {
  const { data } = useStore()
  const [picked, setPicked] = useState<number | null>(null)
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = data.bills.filter((b) => b.paid_at && b.paid_at.slice(0, 7) === key).reduce((s, b) => s + b.amount, 0)
    return { key, label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), total, current: i === 5 }
  })
  const max = Math.max(...months.map((m) => m.total), 1)
  if (months.every((m) => m.total === 0)) return null
  const shown = picked !== null ? months[picked] : null
  const avg = months.slice(0, 5).reduce((s, m) => s + m.total, 0) / 5

  return (
    <>
      <SectionTitle aside={shown ? `${shown.label} · ${euros(shown.total)}` : `moyenne ${euros(avg)}`}>Payé sur 6 mois</SectionTitle>
      <Card className="px-4 pb-3 pt-5">
        <div className="flex h-36 items-end gap-2" role="img" aria-label="Total des factures payées par mois">
          {months.map((m, i) => (
            <button
              key={m.key}
              onClick={() => setPicked(picked === i ? null : i)}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              aria-label={`${m.label} : ${euros(m.total)}`}
            >
              <span
                className={cx(
                  'num text-[10.5px] font-semibold transition-opacity',
                  picked === null || picked === i ? 'text-ink' : 'text-faint',
                )}
              >
                {m.total ? Math.round(m.total) : ''}
              </span>
              <span
                className="w-full max-w-9 rounded-t-[6px] rounded-b-[2px] transition-all duration-500 ease-smooth"
                style={{
                  height: `${Math.max(3, (m.total / max) * 100)}%`,
                  background: 'var(--sec)',
                  opacity: picked === null ? (m.current ? 1 : 0.55) : picked === i ? 1 : 0.25,
                }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 border-t border-line/60 pt-2">
          {months.map((m) => (
            <span
              key={m.key}
              className={cx('flex-1 text-center text-[11.5px] capitalize', m.current ? 'font-semibold text-ink' : 'text-muted')}
            >
              {m.label}
            </span>
          ))}
        </div>
      </Card>
    </>
  )
}

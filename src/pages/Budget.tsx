import { useState, type FormEvent } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { useStore } from '../data/store'
import { totals } from '../lib/finance'
import { money, moneyRound, parseAmount } from '../lib/format'
import { CATEGORIES, type Category, type Charge, type Income } from '../lib/types'
import { Button, Card, Empty, Field, PageHeader, SectionTitle, Select, Sheet, cx } from '../components/ui'

// Couleur liée à la catégorie (jamais à son rang) : un graphique filtré ne repeint pas les survivants.
const CAT_COLOR: Record<Category, string> = Object.fromEntries(CATEGORIES.map((c, i) => [c, `var(--cat-${i + 1})`])) as Record<Category, string>

const SHEET_TITLES = {
  charge: ['Nouvelle charge', 'Modifier la charge'],
  income: ['Nouveau revenu', 'Modifier le revenu'],
} as const

type Editing ={ kind: 'charge'; item: Charge | null } | { kind: 'income'; item: Income | null } | null

export default function BudgetPage() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Editing>(null)
  const t = totals(data)

  const byCat = CATEGORIES.map((c) => {
    const items = data.charges.filter((x) => x.category === c)
    return { cat: c, items, total: items.reduce((s, x) => s + x.amount, 0) }
  }).filter((g) => g.items.length > 0)

  return (
    <>
      <PageHeader title="Budget" subtitle="Mensuel" />

      <Card>
        <dl className="space-y-2.5">
          <Line label="Revenus du foyer" value={`+${money(t.income)}`} />
          <Line label="Charges fixes" value={`−${money(t.charges)}`} />
          <Line label="Abonnements" value={`−${money(t.subs)}`} />
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-semibold">Reste à vivre</span>
          <span className={cx('num text-2xl font-bold', t.left < 0 ? 'text-danger' : 'text-good')}>{money(t.left)}</span>
        </div>
      </Card>

      <SectionTitle>Répartition des charges</SectionTitle>
      <Card>
        {byCat.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Ajoutez des charges pour voir leur répartition.</p>
        ) : (
          <CategoryChart groups={byCat} total={t.charges} />
        )}
      </Card>

      <SectionTitle aside={money(t.income)}>Revenus</SectionTitle>
      <Card className="py-1">
        <ul className="divide-y divide-line">
          {data.incomes.map((i) => (
            <li key={i.id}>
              <button onClick={() => setEditing({ kind: 'income', item: i })} className="flex w-full items-center py-3 text-left active:opacity-60">
                <span className="flex-1 font-medium">{i.label}</span>
                <span className="num font-semibold text-good">+{money(i.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
        <AddButton onClick={() => setEditing({ kind: 'income', item: null })}>Ajouter un revenu</AddButton>
      </Card>

      <SectionTitle aside={money(t.charges)}>Charges fixes</SectionTitle>
      {data.charges.length === 0 ? (
        <Card>
          <Empty icon={<Wallet />} title="Aucune charge" text="Loyer, énergie, assurances… ajoutez vos dépenses fixes mensuelles." />
          <AddButton onClick={() => setEditing({ kind: 'charge', item: null })}>Ajouter une charge</AddButton>
        </Card>
      ) : (
        <Card className="py-1">
          {byCat.map((g) => (
            <div key={g.cat} className="border-b border-line py-2 last:border-0">
              <div className="flex items-center gap-2 pt-1 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: CAT_COLOR[g.cat] }} />
                <span className="flex-1 font-semibold text-muted">{g.cat}</span>
                <span className="num text-muted">{money(g.total)}</span>
              </div>
              <ul>
                {g.items.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setEditing({ kind: 'charge', item: c })} className="flex w-full items-center py-2 pl-4.5 text-left active:opacity-60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.label}</span>
                        {c.debit_day && <span className="block text-xs text-muted">Prélevé le {c.debit_day}</span>}
                      </span>
                      <span className="num font-semibold">{money(c.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <AddButton onClick={() => setEditing({ kind: 'charge', item: null })}>Ajouter une charge</AddButton>
        </Card>
      )}

      <Sheet
        open={editing !== null}
        title={editing ? SHEET_TITLES[editing.kind][editing.item ? 1 : 0] : ''}
        onClose={() => setEditing(null)}
      >
        {editing?.kind === 'charge' && <ChargeForm key={editing.item?.id ?? 'new'} charge={editing.item} onClose={() => setEditing(null)} />}
        {editing?.kind === 'income' && <IncomeForm key={editing.item?.id ?? 'new'} income={editing.item} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  )
}

function AddButton({ onClick, children }: { onClick(): void; children: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 border-t border-line py-3 text-sm font-semibold text-accent">
      <Plus size={18} />
      {children}
    </button>
  )
}

/** Barre empilée à 100 % + légende-tableau. La légende porte les libellés : la couleur n'est jamais seule. */
function CategoryChart({ groups, total }: { groups: { cat: Category; total: number }[]; total: number }) {
  const [active, setActive] = useState<Category | null>(null)
  const sorted = [...groups].sort((a, b) => b.total - a.total)
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const shown = sorted.find((g) => g.cat === active)

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-muted">{shown ? shown.cat : 'Total des charges'}</span>
        <span className="num text-sm font-semibold">
          {shown ? `${money(shown.total)} · ${pct(shown.total).toFixed(0)} %` : moneyRound(total)}
        </span>
      </div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Répartition des charges par catégorie">
        {sorted.map((g) => (
          <button
            key={g.cat}
            title={`${g.cat} : ${money(g.total)}`}
            aria-label={`${g.cat} : ${money(g.total)}`}
            onClick={() => setActive(active === g.cat ? null : g.cat)}
            className="h-full min-w-[4px] transition-opacity"
            style={{ width: `${pct(g.total)}%`, background: CAT_COLOR[g.cat], opacity: active && active !== g.cat ? 0.3 : 1 }}
          />
        ))}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Catégorie</th>
            <th>Part</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <tr
              key={g.cat}
              onClick={() => setActive(active === g.cat ? null : g.cat)}
              className={cx('cursor-pointer transition-opacity', active && active !== g.cat && 'opacity-40')}
            >
              <td className="py-1.5">
                <span className="flex items-center gap-2.5">
                  <span className="size-3 shrink-0 rounded-[4px]" style={{ background: CAT_COLOR[g.cat] }} />
                  <span className="font-medium">{g.cat}</span>
                </span>
              </td>
              <td className="num w-14 py-1.5 text-right text-muted">{pct(g.total).toFixed(0)} %</td>
              <td className="num w-24 py-1.5 text-right font-semibold">{money(g.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeleteButton({ label, onConfirm }: { label: string; onConfirm(): void }) {
  return (
    <Button type="button" variant="danger" aria-label="Supprimer" className="px-4" onClick={() => confirm(`Supprimer « ${label} » ?`) && onConfirm()}>
      <Trash2 size={18} />
    </Button>
  )
}

function ChargeForm({ charge, onClose }: { charge: Charge | null; onClose(): void }) {
  const { insert, update, remove } = useStore()
  const [label, setLabel] = useState(charge?.label ?? '')
  const [category, setCategory] = useState<Category>(charge?.category ?? 'Logement')
  const [amount, setAmount] = useState(charge ? String(charge.amount).replace('.', ',') : '')
  const [day, setDay] = useState(charge?.debit_day ? String(charge.debit_day) : '')
  const [err, setErr] = useState<string | null>(null)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const a = parseAmount(amount)
    const d = day ? parseInt(day) : null
    if (!label.trim()) return setErr('Indiquez un libellé.')
    if (!(a >= 0)) return setErr('Montant invalide.')
    if (d !== null && !(d >= 1 && d <= 31)) return setErr('Le jour de prélèvement doit être entre 1 et 31.')
    const row = { label: label.trim(), category, amount: Math.round(a * 100) / 100, debit_day: d }
    if (charge) update('charges', charge.id, row)
    else insert('charges', row)
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Libellé" placeholder="Loyer, électricité…" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus={!charge} />
      <Select label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant mensuel (€)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="Jour (optionnel)" type="number" inputMode="numeric" min={1} max={31} placeholder="1 à 31" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <p className="px-1 text-xs text-muted">Avec un jour de prélèvement, la charge apparaît dans les prélèvements à venir.</p>
      {err && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{err}</p>}
      <div className="flex gap-3 pt-2">
        {charge && (
          <DeleteButton
            label={charge.label}
            onConfirm={() => {
              remove('charges', charge.id)
              onClose()
            }}
          />
        )}
        <Button className="flex-1">{charge ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </form>
  )
}

function IncomeForm({ income, onClose }: { income: Income | null; onClose(): void }) {
  const { insert, update, remove } = useStore()
  const [label, setLabel] = useState(income?.label ?? '')
  const [amount, setAmount] = useState(income ? String(income.amount).replace('.', ',') : '')
  const [err, setErr] = useState<string | null>(null)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const a = parseAmount(amount)
    if (!label.trim()) return setErr('Indiquez un libellé.')
    if (!(a >= 0)) return setErr('Montant invalide.')
    const row = { label: label.trim(), amount: Math.round(a * 100) / 100 }
    if (income) update('incomes', income.id, row)
    else insert('incomes', row)
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Libellé" placeholder="Salaire, allocations…" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus={!income} />
      <Field label="Montant mensuel net (€)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      {err && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{err}</p>}
      <div className="flex gap-3 pt-2">
        {income && (
          <DeleteButton
            label={income.label}
            onConfirm={() => {
              remove('incomes', income.id)
              onClose()
            }}
          />
        )}
        <Button className="flex-1">{income ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </form>
  )
}

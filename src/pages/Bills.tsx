import { useState, type FormEvent } from 'react'
import { CalendarDays, Check, Euro, Plus, Repeat as RepeatIcon, Scale, Trash2, Users, Zap } from 'lucide-react'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { SearchButton } from '../components/Search'
import { addDays, parseISODate, toISODate, today } from '../lib/dates'
import { ago, capitalize, dueLabel, euros, parseAmount } from '../lib/format'
import type { Bill, BillRepeat } from '../lib/types'
import {
  Avatar,
  Card,
  CheckCircle,
  Collapsible,
  DateRow,
  Empty,
  Hero,
  HeroButton,
  OptionRow,
  SectionTitle,
  Sheet,
  SheetActions,
  SwipeRow,
  TitleInput,
  ToggleRow,
  cx,
  useArrivals,
} from '../components/ui'

type RepeatChoice = BillRepeat | 'none'
const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: 'none', label: 'Une seule fois' },
  { value: 'month', label: 'Chaque mois' },
  { value: 'quarter', label: 'Chaque trimestre' },
  { value: 'year', label: 'Chaque année' },
]

/** Échéance suivante d'une facture qui revient (le 31 tombe au dernier jour des mois courts). */
function nextDue(iso: string, repeat: BillRepeat) {
  const d = parseISODate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + (repeat === 'year' ? 12 : repeat === 'quarter' ? 3 : 1))
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return toISODate(d)
}

export default function BillsPage() {
  const { data, me } = useStore()
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)

  const unpaid = data.bills.filter((b) => !b.paid_at).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const todayISO = toISODate(today())
  const late = unpaid.filter((b) => b.due_date < todayISO)
  const upcoming = unpaid.filter((b) => b.due_date >= todayISO)
  const paid = data.bills
    .filter((b) => b.paid_at && Date.now() - new Date(b.paid_at).getTime() < 30 * 86_400_000)
    .sort((a, b) => b.paid_at!.localeCompare(a.paid_at!))
  const isNew = useArrivals(data.bills.map((b) => b.id))

  // « À payer ce mois-ci » : tout ce qui n'est pas payé et tombe avant la fin du mois (retards compris).
  const monthEnd = toISODate(new Date(today().getFullYear(), today().getMonth() + 1, 0))
  const thisMonth = unpaid.filter((b) => b.due_date <= monthEnd).reduce((s, b) => s + b.amount, 0)
  const lateTotal = late.reduce((s, b) => s + b.amount, 0)
  const nextMonthTotal = unpaid.filter((b) => b.due_date > monthEnd).reduce((s, b) => s + b.amount, 0)

  return (
    <div className="animate-page">
      <Hero
        eyebrow={unpaid.length ? `${unpaid.length} facture${unpaid.length > 1 ? 's' : ''} à payer` : 'Tout est payé'}
        title="Factures"
        action={
          <div className="flex gap-2">
            <SearchButton />
            <HeroButton label="Nouvelle facture" onClick={() => setEditing('new')}>
              <Plus size={22} />
            </HeroButton>
          </div>
        }
      >
        <div className="rounded-[24px] bg-white/14 p-4 ring-1 ring-white/20 backdrop-blur-md">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] opacity-75">À payer ce mois-ci</p>
          <p className="num mt-1 font-serif text-[40px] font-medium leading-none">{euros(thisMonth)}</p>
          <p className="mt-2 text-[13px] opacity-85">
            {lateTotal > 0 ? `dont ${euros(lateTotal)} en retard` : 'Rien en retard'}
            {nextMonthTotal > 0 && ` · ensuite ${euros(nextMonthTotal)}`}
          </p>
        </div>
      </Hero>

      <Balance me={me} />

      {data.bills.length === 0 && (
        <Empty
          emoji="💶"
          title="Aucune facture"
          text="Ajoutez une facture avec son montant et sa date : on vous prévient avant qu'il soit trop tard."
        />
      )}

      {late.length > 0 && (
        <section data-section="factures">
          <SectionTitle aside={euros(lateTotal)}>En retard</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {late.map((b) => (
                <BillRow key={b.id} bill={b} fresh={isNew(b.id)} onEdit={() => setEditing(b)} />
              ))}
            </ul>
          </Card>
        </section>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle>À venir</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {upcoming.map((b) => (
                <BillRow key={b.id} bill={b} fresh={isNew(b.id)} onEdit={() => setEditing(b)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {paid.length > 0 && <PaidList bills={paid} onEdit={setEditing} />}

      <Sheet open={editing !== null} title={editing === 'new' ? 'Nouvelle facture' : 'Facture'} onClose={() => setEditing(null)}>
        {editing && (
          <BillForm
            key={editing === 'new' ? 'new' : editing.id}
            bill={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

/** Payer une facture : la marque payée et prépare la suivante si elle revient. */
function usePay() {
  const { data, update, insert, me } = useStore()
  return (bill: Bill) => {
    update('bills', bill.id, { paid_at: new Date().toISOString(), paid_by: me })
    if (bill.repeat) {
      const next = nextDue(bill.due_date, bill.repeat)
      const exists = data.bills.some((b) => b.id !== bill.id && b.title === bill.title && b.due_date === next)
      if (!exists)
        insert('bills', {
          title: bill.title,
          amount: bill.amount,
          due_date: next,
          assignee: bill.assignee,
          repeat: bill.repeat,
          auto_debit: bill.auto_debit,
          shared: bill.shared,
        })
    }
  }
}

function BillRow({ bill, fresh, onEdit }: { bill: Bill; fresh: boolean; onEdit(): void }) {
  const { removeWithUndo } = useStore()
  const pay = usePay()
  const member = useMember()
  const [leaving, setLeaving] = useState(false)
  const due = dueLabel(bill.due_date)
  const who = bill.assignee ? member(bill.assignee) : null

  const doPay = (delay = 560) => {
    setLeaving(true)
    setTimeout(() => pay(bill), delay)
  }

  return (
    <Collapsible leaving={leaving} className={cx('border-b border-line/60 last:border-0', fresh && 'animate-pop')}>
      <SwipeRow
        right={{ label: 'Payée', icon: <Check size={18} strokeWidth={2.6} />, tone: 'done', run: () => doPay(200) }}
        left={{ label: 'Supprimer', icon: <Trash2 size={18} />, tone: 'late', run: () => removeWithUndo('bills', bill.id, bill.title) }}
      >
        <div className="flex min-h-16 items-center gap-3 px-4 py-3">
          <CheckCircle
            checked={leaving}
            tone={due.late ? 'late' : 'default'}
            onClick={() => doPay()}
            label={`Marquer ${bill.title} comme payée`}
          />
          <button onClick={onEdit} className="min-w-0 flex-1 text-left">
            <span className={cx('block truncate text-[16px] leading-snug', leaving && 'text-muted line-through')}>{bill.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] leading-5 text-muted">
              <span className={cx('font-medium', due.late ? 'text-late' : due.days <= 3 ? 'text-sec' : '')}>
                {due.late ? due.text : `Avant le ${bill.due_date.slice(8, 10)}/${bill.due_date.slice(5, 7)}`}
              </span>
              {who && (
                <>
                  <span className="text-faint">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Avatar initial={who.initial} tone={who.tone} size="xs" />
                    {who.isMe ? 'Moi' : who.name}
                  </span>
                </>
              )}
              {bill.auto_debit && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-sec/12 px-1.5 text-sec" title="Prélèvement automatique">
                  <Zap size={11} /> auto
                </span>
              )}
              {bill.repeat && <RepeatIcon size={12} strokeWidth={2.4} className="text-sec" />}
              {bill.shared && <Scale size={12} className="text-sec" />}
            </span>
          </button>
          <span className={cx('num shrink-0 text-[17px] font-semibold', due.late ? 'text-late' : '')}>{euros(bill.amount)}</span>
        </div>
      </SwipeRow>
    </Collapsible>
  )
}

function PaidList({ bills, onEdit }: { bills: Bill[]; onEdit(b: Bill): void }) {
  const { update } = useStore()
  const member = useMember()
  const [open, setOpen] = useState(false)
  const shown = open ? bills : bills.slice(0, 3)
  return (
    <>
      <SectionTitle
        aside={bills.length > 3 && <button onClick={() => setOpen(!open)}>{open ? 'Réduire' : `Tout voir (${bills.length})`}</button>}
      >
        Payées ce mois-ci
      </SectionTitle>
      <ul>
        {shown.map((b) => {
          const by = b.paid_by ? member(b.paid_by) : null
          return (
            <li key={b.id} className="animate-fade flex min-h-12 items-center gap-3 px-4">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-sec/15 text-sec">
                <Check size={14} strokeWidth={3} />
              </span>
              <button onClick={() => onEdit(b)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px] text-muted">{b.title}</span>
                <span className="block text-[12px] text-faint">
                  {by ? `Payée par ${by.isMe ? 'moi' : by.name}` : 'Prélevée'} · {ago(b.paid_at!)}
                </span>
              </button>
              <span className="num text-[14px] text-muted">{euros(b.amount)}</span>
              <button
                onClick={() => update('bills', b.id, { paid_at: null, paid_by: null })}
                className="rounded-full px-2 py-1 text-[12px] font-medium text-muted active:bg-surface-2"
              >
                Annuler
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** « Qui doit quoi » : une petite barre, seulement quand il y a quelque chose à équilibrer. */
function Balance({ me }: { me: string }) {
  const { data, update, showToast } = useStore()
  const partner = usePartner()
  const member = useMember()
  const open = data.bills.filter((b) => b.shared && b.paid_at && b.paid_by && !b.settled)
  // Positif : l'autre me doit ; négatif : je dois à l'autre. Chaque facture partagée compte pour moitié.
  const net = open.reduce((s, b) => s + (b.paid_by === me ? b.amount / 2 : -b.amount / 2), 0)
  if (!partner || Math.abs(net) < 0.01) return null
  const p = member(partner.user_id)
  const text = net > 0 ? `${p.name} vous doit ${euros(net)}` : `Vous devez ${euros(-net)} à ${p.name}`

  return (
    <div className="animate-pop -mt-2 mb-2 flex h-11 items-center gap-2 rounded-full bg-surface pl-4 pr-1.5 text-[13.5px] ring-1 ring-line/60">
      <Scale size={15} className="shrink-0 text-sec" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <button
        onClick={() => {
          const ids = open.map((b) => b.id)
          ids.forEach((id) => update('bills', id, { settled: true }))
          showToast('Comptes remis à zéro', () => ids.forEach((id) => update('bills', id, { settled: false })))
        }}
        className="h-8 shrink-0 rounded-full bg-sec/15 px-3 text-[12.5px] font-semibold text-sec active:scale-95"
      >
        C'est réglé
      </button>
    </div>
  )
}

function BillForm({ bill, onClose }: { bill: Bill | null; onClose(): void }) {
  const { insert, update, remove } = useStore()
  const { me } = useSession()
  const partner = usePartner()
  const [title, setTitle] = useState(bill?.title ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.amount).replace('.', ',') : '')
  const [due, setDue] = useState(bill?.due_date ?? toISODate(addDays(today(), 7)))
  const [assignee, setAssignee] = useState(bill?.assignee ?? 'both')
  const [repeat, setRepeat] = useState<RepeatChoice>(bill?.repeat ?? 'none')
  const [auto, setAuto] = useState(bill?.auto_debit ?? false)
  const [shared, setShared] = useState(bill?.shared ?? false)
  const [paidBy, setPaidBy] = useState(bill?.paid_by ?? me.user_id)
  const [err, setErr] = useState<string | null>(null)

  const people = [{ value: me.user_id, label: 'Moi' }, ...(partner ? [{ value: partner.user_id, label: partner.display_name }] : [])]

  const save = (e: FormEvent) => {
    e.preventDefault()
    const a = parseAmount(amount)
    if (!title.trim()) return setErr('Indiquez à quoi correspond la facture.')
    if (!(a >= 0)) return setErr('Montant invalide.')
    if (!due) return setErr('Indiquez la date limite.')
    const row = {
      title: capitalize(title.trim()),
      amount: a,
      due_date: due,
      assignee: assignee === 'both' ? null : assignee,
      repeat: repeat === 'none' ? null : repeat,
      auto_debit: auto,
      shared,
    }
    if (bill)
      update('bills', bill.id, {
        ...row,
        ...(bill.paid_at ? { paid_by: paidBy } : {}),
        ...(due !== bill.due_date ? { reminded_soon: false, reminded_due: false } : {}),
      } as never)
    else insert('bills', row)
    onClose()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <TitleInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="EDF, crèche, assurance…"
        aria-label="À quoi correspond la facture"
        autoFocus={!bill}
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
      <DateRow label="Avant le" icon={<CalendarDays size={18} />} value={due} onChange={setDue} />
      <OptionRow
        label="Qui s'en occupe ?"
        icon={<Users size={18} />}
        value={assignee}
        onChange={setAssignee}
        options={[{ value: 'both', label: 'Nous deux' }, ...people]}
      />
      <OptionRow<RepeatChoice>
        label="Revient ?"
        icon={<RepeatIcon size={18} />}
        value={repeat}
        onChange={setRepeat}
        options={REPEAT_OPTIONS}
      />
      <ToggleRow
        label="Prélèvement automatique"
        hint="Se coche tout seul le jour J, sans rappel"
        icon={<Zap size={18} />}
        checked={auto}
        onChange={setAuto}
      />
      <ToggleRow
        label="À partager moitié-moitié"
        hint="Compte dans « qui doit quoi »"
        icon={<Scale size={18} />}
        checked={shared}
        onChange={setShared}
      />
      {bill?.paid_at && <OptionRow label="Payée par" icon={<Check size={18} />} value={paidBy} onChange={setPaidBy} options={people} />}
      {err && <p className="text-center text-[14px] text-late">{err}</p>}
      <SheetActions
        saveLabel={bill ? 'Enregistrer' : 'Ajouter la facture'}
        deleteLabel="Supprimer la facture"
        onDelete={
          bill
            ? () => {
                remove('bills', bill.id)
                onClose()
              }
            : undefined
        }
      />
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import { BellRing, ChevronRight, CircleCheckBig, Pencil, Receipt, Settings, ShoppingCart, SmilePlus, Sparkles } from 'lucide-react'
import type { Tab } from '../App'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { ago, dueLabel, euros, greeting, longDate } from '../lib/format'
import { REACTIONS, type Note, type Reaction } from '../lib/types'
import { Avatar, Button, Card, Composer, Hero, HeroButton, SectionTitle, Sheet, SheetActions, cx, useArrivals } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'
import { SearchButton } from '../components/Search'
import { today } from '../lib/dates'

export default function HomePage({ go }: { go(t: Tab): void }) {
  const { me } = useSession()
  const { data } = useStore()
  const [settings, setSettings] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const groceries = data.grocery_items.filter((i) => !i.list_id && i.status !== 'bought')
  const todos = data.todos.filter((t) => !t.done_at)
  const late = todos.filter((t) => t.due_date && dueLabel(t.due_date).late).length
  const lists = data.lists
    .map((l) => {
      const items = data.list_items.filter((i) => i.list_id === l.id)
      return {
        ...l,
        total: items.length,
        done: items.filter((i) => i.done).length,
      }
    })
    .filter((l) => l.total > 0 && l.done < l.total)
  const unpaid = data.bills.filter((b) => !b.paid_at && !b.auto_debit)
  const unpaidLate = unpaid.some((b) => dueLabel(b.due_date).late)

  return (
    <div className="animate-page">
      <Hero
        eyebrow={longDate(new Date())}
        title={`${greeting()} ${me.display_name}`}
        action={
          <div className="flex gap-2">
            <SearchButton />
            <HeroButton label="Réglages" onClick={() => setSettings(true)}>
              <Settings size={19} />
            </HeroButton>
          </div>
        }
      >
        <DaySummary go={go} />
      </Hero>

      {/* Raccourcis discrets : l'essentiel du jour est déjà au-dessus. */}
      <SectionTitle>En ce moment</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        <Tile section="courses" emoji="🛒" value={groceries.length} label="à prendre" onClick={() => go('courses')} />
        <Tile section="afaire" emoji="📝" value={todos.length} label="à faire" alert={late > 0} onClick={() => go('afaire')} />
        <Tile section="listes" emoji="🗂️" value={lists.length} label={lists.length > 1 ? 'listes' : 'liste'} onClick={() => go('listes')} />
        <Tile section="factures" emoji="💶" value={unpaid.length} label="à payer" alert={unpaidLate} onClick={() => go('factures')} />
      </div>

      {lists.length > 0 && (
        <div data-section="listes">
          <SectionTitle>Listes en cours</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {lists.map((l) => (
                <li key={l.id} className="border-b border-line/60 last:border-0">
                  <button
                    onClick={() => go('listes')}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-surface-2"
                  >
                    <span className="grid size-8 place-items-center rounded-xl bg-sec/15 text-[16px]">{l.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[16px]">{l.title}</span>
                    <span className="num text-[13px] font-semibold text-sec">
                      {l.done}/{l.total}
                    </span>
                    <ChevronRight size={16} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <MiniNotes notes={data.notes} onOpen={() => setNotesOpen(true)} />

      <Sheet open={notesOpen} title="Petits mots" onClose={() => setNotesOpen(false)}>
        {notesOpen && <NotesPanel notes={data.notes} />}
      </Sheet>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  )
}

function Tile({
  section,
  emoji,
  value,
  label,
  alert,
  onClick,
}: {
  section: Tab
  emoji: string
  value: number
  label: string
  alert?: boolean
  onClick(): void
}) {
  return (
    <button
      data-section={section}
      onClick={onClick}
      aria-label={`${value} ${label}`}
      className="relative flex flex-col items-center rounded-[20px] bg-surface px-1 pb-2.5 pt-3 ring-1 ring-line/50 transition duration-300 ease-smooth active:scale-[0.95]"
    >
      {alert && <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-late shadow-[0_0_8px_var(--late)]" />}
      <span className="text-[18px] leading-none">{emoji}</span>
      <span className="num mt-1.5 font-serif text-[24px] font-medium leading-none text-sec">{value}</span>
      <span className="mt-1 text-[11.5px] text-muted">{label}</span>
    </button>
  )
}

/** Mini bandeau en bas de l'Accueil : le dernier mot, et de quoi en écrire un. L'historique s'ouvre d'un appui. */
function MiniNotes({ notes, onOpen }: { notes: Note[]; onOpen(): void }) {
  const { insert } = useStore()
  const partner = usePartner()
  const member = useMember()
  const [text, setText] = useState('')
  const isNew = useArrivals(notes.map((n) => n.id))
  const latest = notes[0]
  const who = latest ? member(latest.author) : null

  const send = () => {
    const body = text.trim()
    if (!body) return
    insert('notes', { body })
    setText('')
  }

  return (
    <section data-section="accueil">
      <SectionTitle aside={notes.length > 0 && <button onClick={onOpen}>Tout voir</button>}>Petits mots</SectionTitle>
      <Card className="space-y-3 p-3">
        {latest && who ? (
          <button
            key={latest.id}
            onClick={onOpen}
            className={cx('flex w-full items-start gap-2.5 px-1 pt-0.5 text-left', isNew(latest.id) && 'animate-pop')}
          >
            <Avatar initial={who.initial} tone={who.tone} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-serif text-[17px] leading-snug">« {latest.body} »</span>
              <span className="mt-0.5 block text-[12px] text-muted">
                {who.isMe ? 'Vous' : who.name} · {ago(latest.created_at)}
              </span>
            </span>
          </button>
        ) : (
          <p className="px-1 text-[14px] text-muted">Laissez un premier mot{partner ? ` à ${partner.display_name}` : ''} 💌</p>
        )}
        <Composer
          value={text}
          onChange={setText}
          onSubmit={send}
          placeholder={partner ? `Un mot pour ${partner.display_name}…` : 'Écrire un mot…'}
          label="Écrire un petit mot"
          enterKeyHint="send"
        />
      </Card>
    </section>
  )
}

/** Les petits mots, rangés derrière le bouton 💬 : écrire en haut, puis les mots du plus récent au plus ancien. */
function NotesPanel({ notes }: { notes: Note[] }) {
  const { insert, me } = useStore()
  const partner = usePartner()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [showAll, setShowAll] = useState(false)
  const isNew = useArrivals(notes.map((n) => n.id))
  const shown = showAll ? notes : notes.slice(0, 6)

  const send = () => {
    const body = text.trim()
    if (!body) return
    insert('notes', { body })
    setText('')
  }

  // Modifier un mot remplace la liste le temps de la modification (pas de fiche sur une fiche).
  if (editing) return <NoteForm key={editing.id} note={editing} onClose={() => setEditing(null)} />

  return (
    <div className="space-y-3">
      <Composer
        value={text}
        onChange={setText}
        onSubmit={send}
        placeholder={partner ? `Un mot pour ${partner.display_name}…` : 'Écrire un mot…'}
        label="Écrire un petit mot"
        enterKeyHint="send"
      />
      {notes.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">Pas encore de mot. Le premier fera plaisir 💌</p>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {shown.map((n) => (
              <li key={n.id} className="flex items-start gap-3 border-b border-line/60 px-4 py-3.5 last:border-0">
                <NoteBody note={n} animate={isNew(n.id)} onEdit={n.author === me ? () => setEditing(n) : undefined} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      {notes.length > 6 && (
        <button onClick={() => setShowAll(!showAll)} className="mx-auto block h-10 px-4 text-[14px] font-semibold text-sec">
          {showAll ? 'Réduire' : `Tout voir (${notes.length})`}
        </button>
      )}
    </div>
  )
}

/** Un mot : son texte, qui l'a écrit et quand. Le sien se touche pour le modifier. */
function NoteBody({ note, big, animate, onEdit }: { note: Note; big?: boolean; animate?: boolean; onEdit?(): void }) {
  const m = useMember()(note.author)
  const Text = onEdit ? 'button' : 'p'
  return (
    <div className={cx('min-w-0 flex-1', animate && 'animate-pop')}>
      <Text
        {...(onEdit
          ? {
              type: 'button' as const,
              onClick: onEdit,
              'aria-label': 'Modifier ce mot',
            }
          : {})}
        className={cx(
          'block w-full break-words text-left transition-opacity active:opacity-60',
          big ? 'font-serif text-[24px] leading-[1.28]' : 'text-[15px] leading-snug',
        )}
      >
        {big ? `« ${note.body} »` : note.body}
      </Text>
      <p className={cx('flex items-center gap-1.5', big ? 'mt-3 text-[13px] opacity-80' : 'mt-1.5 text-[12px] text-muted')}>
        <Avatar initial={m.initial} tone={m.tone} size="xs" />
        <span className="min-w-0 flex-1 truncate">
          {m.isMe ? 'Vous' : m.name} · {ago(note.created_at)}
        </span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="flex items-center gap-1 font-semibold active:opacity-60">
            <Pencil size={12} /> Modifier
          </button>
        )}
      </p>
      <Reactions note={note} glass={big} />
    </div>
  )
}

/** Modifier ou supprimer son mot ; la suppression demande une confirmation. */
function NoteForm({ note, onClose }: { note: Note; onClose(): void }) {
  const { update, remove } = useStore()
  const [body, setBody] = useState(note.body)
  const [confirm, setConfirm] = useState(false)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) return setConfirm(true)
    if (text !== note.body) update('notes', note.id, { body: text })
    onClose()
  }

  if (confirm)
    return (
      <div className="flex animate-pop flex-col items-center gap-2 pb-1 pt-2 text-center">
        <p className="font-serif text-[22px]">Supprimer ce mot ?</p>
        <p className="mb-3 line-clamp-2 text-[14px] text-muted">« {note.body} »</p>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            remove('notes', note.id)
            onClose()
          }}
        >
          Oui, supprimer
        </Button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="h-11 px-4 text-[14px] font-semibold text-muted active:opacity-60"
        >
          Annuler
        </button>
      </div>
    )

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        aria-label="Texte du mot"
        className="w-full resize-none rounded-2xl bg-surface-2 px-4 py-4 text-center font-serif text-[21px] leading-snug outline-none ring-1 ring-line/50 focus:ring-2 focus:ring-sec/50"
      />
      <SheetActions deleteLabel="Supprimer ce mot" onDelete={() => setConfirm(true)} />
    </form>
  )
}

/** Réactions sous un petit mot : une par personne, un appui pour changer ou retirer. */
function Reactions({ note, glass }: { note: Note; glass?: boolean }) {
  const { data, insert, update, remove, me } = useStore()
  const member = useMember()
  const [picking, setPicking] = useState(false)
  const list = data.note_reactions.filter((r) => r.note_id === note.id)
  const mine = list.find((r) => r.user_id === me)

  const choose = (emoji: Reaction) => {
    if (mine?.emoji === emoji) remove('note_reactions', mine.id)
    else if (mine) update('note_reactions', mine.id, { emoji })
    else insert('note_reactions', { note_id: note.id, emoji })
    setPicking(false)
  }

  const chip = glass ? 'bg-white/16 ring-white/25' : 'bg-surface-2 ring-line'
  return (
    <div className="mt-2.5 flex min-h-8 flex-wrap items-center gap-1.5">
      {list.map((r) => {
        const who = member(r.user_id)
        return (
          <button
            key={r.id}
            onClick={() => r.user_id === me && choose(r.emoji)}
            title={who.isMe ? 'Votre réaction (appuyer pour retirer)' : `${who.name} a réagi`}
            className={cx(
              'animate-pop flex h-8 items-center gap-1 rounded-full pl-2 pr-1.5 text-[15px] ring-1 transition active:scale-90',
              chip,
            )}
          >
            {r.emoji}
            <Avatar initial={who.initial} tone={who.tone} size="xs" />
          </button>
        )
      })}
      {picking ? (
        <div
          className={cx(
            'animate-pop flex h-8 items-center gap-0.5 rounded-full px-1 ring-1',
            glass ? 'bg-white/22 ring-white/30 backdrop-blur-md' : 'bg-surface shadow-soft ring-line',
          )}
        >
          {REACTIONS.map((e, i) => (
            <button
              key={e}
              onClick={() => choose(e)}
              aria-label={`Réagir ${e}`}
              className="animate-pop grid size-7 place-items-center rounded-full text-[17px] transition active:scale-75"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          aria-label="Ajouter une réaction"
          className={cx('grid size-8 place-items-center rounded-full transition active:scale-90', glass ? 'opacity-75' : 'text-faint')}
        >
          <SmilePlus size={17} />
        </button>
      )}
    </div>
  )
}

type SummaryLine = {
  key: string
  section: Tab
  icon: React.ReactNode
  title: string
  items: { text: string; meta?: string; urgent?: boolean }[]
}

const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Le résumé du jour : rappels, tâches du jour, courses, et l'autre parti(e) aux courses. */
function DaySummary({ go }: { go(t: Tab): void }) {
  const { data, me } = useStore()
  const member = useMember()
  const start = today()
  const end = new Date(start.getTime() + 86_400_000)
  const isToday = (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= start.getTime() && t < end.getTime()
  }
  const forMe = (to: string | null) => to === null || to === me

  // Rappels encore à venir aujourd'hui (tâches et éléments de liste), du plus proche au plus lointain.
  const reminders = [
    ...data.todos
      .filter((t) => !t.done_at && t.remind_at && !t.reminded_at && isToday(t.remind_at) && forMe(t.remind_to))
      .map((t) => ({ at: t.remind_at!, text: t.title })),
    ...data.list_items
      .filter((i) => !i.done && i.remind_at && !i.reminded_at && isToday(i.remind_at) && forMe(i.remind_to))
      .map((i) => ({ at: i.remind_at!, text: i.text })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  const tasks = data.todos.filter(
    (t) => !t.done_at && t.due_date && dueLabel(t.due_date).days <= 0 && (t.assignee === null || t.assignee === me),
  )
  const late = tasks.filter((t) => dueLabel(t.due_date!).late)
  const groceries = data.grocery_items.filter((i) => !i.list_id && i.status !== 'bought')
  const ping = data.pings.find((p) => p.author !== me && Date.now() - new Date(p.created_at).getTime() < 2 * 3_600_000)

  const lines: SummaryLine[] = []
  if (reminders.length)
    lines.push({
      key: 'rappels',
      section: 'afaire',
      icon: <BellRing size={17} />,
      title: `${reminders.length} rappel${reminders.length > 1 ? 's' : ''}`,
      items: reminders.slice(0, 3).map((r) => ({
        text: r.text,
        meta: hhmm(r.at),
        urgent: new Date(r.at).getTime() - Date.now() < 3_600_000,
      })),
    })
  if (tasks.length)
    lines.push({
      key: 'taches',
      section: 'afaire',
      icon: <CircleCheckBig size={17} />,
      title: `${tasks.length} chose${tasks.length > 1 ? 's' : ''} à faire${late.length ? ` · ${late.length} en retard` : ''}`,
      items: tasks.slice(0, 3).map((t) => ({
        text: t.title,
        meta: dueLabel(t.due_date!).late ? 'en retard' : undefined,
        urgent: dueLabel(t.due_date!).late,
      })),
    })
  // Factures en retard ou à payer dans les 3 prochains jours (pour moi ou pour nous deux).
  const bills = data.bills
    .filter((b) => !b.paid_at && !b.auto_debit && dueLabel(b.due_date).days <= 3 && (b.assignee === null || b.assignee === me))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  if (bills.length)
    lines.push({
      key: 'factures',
      section: 'factures',
      icon: <Receipt size={17} />,
      title: `${bills.length} facture${bills.length > 1 ? 's' : ''} à payer · ${euros(bills.reduce((s, b) => s + b.amount, 0))}`,
      items: bills.slice(0, 3).map((b) => {
        const d = dueLabel(b.due_date)
        return {
          text: `${b.title} · ${euros(b.amount)}`,
          meta: d.late ? 'en retard' : d.text,
          urgent: d.late || d.days === 0,
        }
      }),
    })
  if (groceries.length || ping) {
    const who = ping ? member(ping.author) : null
    lines.push({
      key: 'courses',
      section: 'courses',
      icon: <ShoppingCart size={17} />,
      title: `${groceries.length} article${groceries.length > 1 ? 's' : ''} à prendre`,
      items: who
        ? [
            {
              text: `${who.name} est parti${who.pronoun === 'elle' ? 'e' : ''} faire les courses`,
              meta: ago(ping!.created_at),
              urgent: true,
            },
          ]
        : [],
    })
  }

  // Ce qui presse remonte en premier.
  const urgent = (l: SummaryLine) => l.items.some((it) => it.urgent)
  lines.sort((a, b) => Number(urgent(b)) - Number(urgent(a)))

  // Dans le bandeau du haut, en verre dépoli comme le reste de l'en-tête.
  return (
    <div className="overflow-hidden rounded-[24px] bg-white/14 ring-1 ring-white/20 backdrop-blur-md">
      <p className="px-4 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">Aujourd'hui</p>
      {lines.length === 0 ? (
        <div className="flex items-center gap-3 px-4 pb-4 pt-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-white/18">
            <Sparkles size={19} />
          </span>
          <span>
            <span className="block font-serif text-[21px] font-medium leading-tight">Journée tranquille</span>
            <span className="block text-[13px] opacity-80">Rien de prévu pour vous aujourd'hui.</span>
          </span>
        </div>
      ) : (
        <ul className="pt-1">
          {lines.map((l) => (
            <li key={l.key} className="relative border-b border-white/15 last:border-0">
              {urgent(l) && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-white" />}
              <button onClick={() => go(l.section)} className="flex w-full gap-3 px-4 py-3 text-left transition-opacity active:opacity-70">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/18">{l.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold">{l.title}</span>
                    <ChevronRight size={16} className="opacity-60" />
                  </span>
                  {l.items.length > 0 && (
                    <span className="mt-1 block space-y-0.5">
                      {l.items.map((it, i) => (
                        <span key={i} className="flex items-baseline gap-2 text-[14px]">
                          {it.meta && (
                            <span
                              className={cx(
                                'num shrink-0 text-[12px] font-bold',
                                it.urgent ? 'rounded-full bg-white px-1.5 text-[var(--late)]' : 'opacity-90',
                              )}
                            >
                              {it.meta}
                            </span>
                          )}
                          <span className="truncate opacity-85">{it.text}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

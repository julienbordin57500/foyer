import { useState, type FormEvent } from 'react'
import { ChevronRight, Pencil, Settings, SmilePlus } from 'lucide-react'
import type { Tab } from '../App'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { ago, dueLabel, euros, greeting, longDate } from '../lib/format'
import { REACTIONS, type Note, type Reaction } from '../lib/types'
import { Avatar, Button, Card, Composer, Hero, HeroButton, SectionTitle, Sheet, SheetActions, cx, useArrivals } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'
import { SearchButton } from '../components/Search'
import { addDays, toISODate, today } from '../lib/dates'

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
        {/* Raccourcis : les quatre compteurs, en cases sombres dans le bandeau. */}
        <div className="grid grid-cols-4 gap-2">
          <Tile emoji="🛒" value={groceries.length} label="à prendre" onClick={() => go('courses')} />
          <Tile emoji="📝" value={todos.length} label="à faire" alert={late > 0} onClick={() => go('afaire')} />
          <Tile emoji="🗂️" value={lists.length} label={lists.length > 1 ? 'listes' : 'liste'} onClick={() => go('listes')} />
          <Tile emoji="💶" value={unpaid.length} label="à payer" alert={unpaidLate} onClick={() => go('factures')} />
        </div>
      </Hero>

      <Week go={go} />

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

function Tile({ emoji, value, label, alert, onClick }: { emoji: string; value: number; label: string; alert?: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${value} ${label}`}
      className="relative flex flex-col items-center rounded-[20px] bg-black/25 px-1 pb-2.5 pt-3 ring-1 ring-white/10 transition duration-300 ease-smooth active:scale-[0.95]"
    >
      {alert && <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-white shadow-[0_0_8px_white]" />}
      <span className="text-[18px] leading-none">{emoji}</span>
      <span className="num mt-1.5 font-serif text-[24px] font-medium leading-none">{value}</span>
      <span className="mt-1 text-[11.5px] opacity-75">{label}</span>
    </button>
  )
}

type WeekItem = { key: string; tab: Tab; emoji: string; text: string; meta?: string }
const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })

/** Les 7 prochains jours en cases : un point par chose prévue, un appui montre le détail du jour. */
function Week({ go }: { go(t: Tab): void }) {
  const { data } = useStore()
  const member = useMember()
  const [picked, setPicked] = useState<string | null>(null)
  const start = today()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    const iso = toISODate(d)
    const items: WeekItem[] = [
      ...data.todos
        .filter((t) => !t.done_at && t.due_date === iso)
        .map((t) => ({
          key: t.id,
          tab: 'afaire' as Tab,
          emoji: '📝',
          text: t.title,
          meta: t.assignee ? member(t.assignee).name : undefined,
        })),
      ...data.list_items
        .filter((i) => !i.done && i.remind_at && toISODate(new Date(i.remind_at)) === iso)
        .map((i) => ({ key: i.id, tab: 'listes' as Tab, emoji: '🔔', text: i.text })),
      ...data.bills
        .filter((b) => !b.paid_at && b.due_date === iso)
        .map((b) => ({
          key: b.id,
          tab: 'factures' as Tab,
          emoji: '💶',
          text: `${b.title} · ${euros(b.amount)}`,
          meta: b.auto_debit ? 'prélevé' : undefined,
        })),
    ]
    return { iso, d, items, label: i === 0 ? 'auj.' : WEEKDAY.format(d) }
  })
  const day = days.find((x) => x.iso === picked)

  return (
    <section>
      <SectionTitle aside={!day && <span className="normal-case">Touchez un jour</span>}>Cette semaine</SectionTitle>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((x) => {
          const on = x.iso === picked
          return (
            <button
              key={x.iso}
              onClick={() => setPicked(on ? null : x.iso)}
              aria-pressed={on}
              aria-label={`${x.label} ${x.d.getDate()} : ${x.items.length} chose${x.items.length > 1 ? 's' : ''}`}
              className={cx(
                'flex flex-col items-center rounded-[18px] pb-2 pt-2.5 transition duration-200 ease-smooth active:scale-[0.94]',
                on ? 'bg-sec text-bg shadow-[0_6px_18px_-8px_var(--sec)]' : 'bg-surface ring-1 ring-line/50',
              )}
            >
              <span className={cx('text-[11px] font-semibold uppercase tracking-wide', on ? 'opacity-80' : 'text-muted')}>
                {x.label.replace('.', '')}
              </span>
              <span className="num mt-0.5 font-serif text-[21px] font-medium leading-tight">{x.d.getDate()}</span>
              <span className="mt-1 flex h-1.5 items-center gap-0.5">
                {x.items.slice(0, 3).map((it) => (
                  <span key={it.key} className={cx('size-1.5 rounded-full', on ? 'bg-bg/70' : 'bg-sec')} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      {day && (
        <Card key={day.iso} className="mt-2 animate-pop overflow-hidden">
          {day.items.length === 0 ? (
            <p className="px-4 py-4 text-center text-[14px] text-muted">Rien de prévu ce jour-là.</p>
          ) : (
            <ul>
              {day.items.map((it) => (
                <li key={it.key} className="border-b border-line/60 last:border-0">
                  <button
                    onClick={() => go(it.tab)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-surface-2"
                  >
                    <span className="text-[16px]">{it.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{it.text}</span>
                    {it.meta && <span className="shrink-0 text-[12.5px] text-muted">{it.meta}</span>}
                    <ChevronRight size={16} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
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

import { useState } from 'react'
import { ChevronRight, Settings, SmilePlus, X } from 'lucide-react'
import type { Tab } from '../App'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { ago, dueLabel, greeting, longDate } from '../lib/format'
import { REACTIONS, type Note, type Reaction } from '../lib/types'
import { Avatar, Card, Composer, SectionTitle, cx, useArrivals } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'

export default function HomePage({ go }: { go(t: Tab): void }) {
  const { me } = useSession()
  const { data } = useStore()
  const [settings, setSettings] = useState(false)

  const groceries = data.grocery_items.filter((i) => i.status !== 'bought')
  const toOrder = groceries.filter((i) => i.place === 'drive' && i.status === 'todo').length
  const todos = data.todos.filter((t) => !t.done_at)
  const mine = todos.filter((t) => t.assignee === me.user_id || t.assignee === null)
  const late = todos.filter((t) => t.due_date && dueLabel(t.due_date).late).length
  const todayCount = todos.filter((t) => t.due_date && dueLabel(t.due_date).days === 0).length
  const lists = data.lists
    .map((l) => {
      const items = data.list_items.filter((i) => i.list_id === l.id)
      return { ...l, total: items.length, done: items.filter((i) => i.done).length }
    })
    .filter((l) => l.total > 0 && l.done < l.total)

  return (
    <div className="animate-page">
      <header className="pt-safe mb-6 flex min-h-[76px] items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="mb-1.5 h-[18px] text-[13px] font-medium text-muted first-letter:uppercase">{longDate(new Date())}</p>
          <h1 className="truncate font-serif text-[36px] font-medium leading-[1.05] tracking-[-0.01em]">
            {greeting()} {me.display_name}
          </h1>
        </div>
        <button
          onClick={() => setSettings(true)}
          aria-label="Réglages"
          className="mb-1 grid size-10 shrink-0 place-items-center rounded-full bg-surface text-muted shadow-soft ring-1 ring-line/80 transition duration-300 ease-smooth active:scale-90"
        >
          <Settings size={18} />
        </button>
      </header>

      <Notes notes={data.notes} />

      <SectionTitle>En ce moment</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          emoji="🧺"
          value={groceries.length}
          label={groceries.length > 1 ? 'articles à prendre' : 'article à prendre'}
          detail={toOrder ? `${toOrder} à commander au drive` : undefined}
          onClick={() => go('courses')}
        />
        <Tile
          emoji="📝"
          value={todos.length}
          label={todos.length > 1 ? 'choses à faire' : 'chose à faire'}
          detail={late ? `${late} en retard` : todayCount ? `${todayCount} pour aujourd'hui` : mine.length ? `${mine.length} pour moi` : undefined}
          alert={late > 0}
          onClick={() => go('afaire')}
        />
      </div>

      {lists.length > 0 && (
        <>
          <SectionTitle>Listes en cours</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {lists.map((l) => (
                <li key={l.id} className="border-b border-line/70 last:border-0">
                  <button onClick={() => go('listes')} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-surface-2">
                    <span className="grid size-[26px] place-items-center text-[18px]">{l.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[16px]">{l.title}</span>
                    <span className="num text-[13px] text-muted">
                      {l.done}/{l.total}
                    </span>
                    <ChevronRight size={16} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  )
}

function Tile({ emoji, value, label, detail, alert, onClick }: { emoji: string; value: number; label: string; detail?: string; alert?: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[148px] flex-col rounded-[24px] bg-surface p-4 text-left shadow-soft ring-1 ring-line/80 transition duration-300 ease-smooth active:scale-[0.97]"
    >
      <span className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-[18px]">{emoji}</span>
        <ChevronRight size={16} className="text-faint" />
      </span>
      <span className="num mt-auto block pt-3 font-serif text-[36px] font-medium leading-none">{value}</span>
      <span className="mt-1 block text-[13px] text-muted">{label}</span>
      <span className={cx('mt-1.5 block min-h-4 text-[12.5px] font-medium leading-4', alert ? 'text-late' : 'text-accent')}>{detail}</span>
    </button>
  )
}

function Notes({ notes }: { notes: Note[] }) {
  const { insert, remove, me } = useStore()
  const partner = usePartner()
  const member = useMember()
  const [text, setText] = useState('')
  const [showAll, setShowAll] = useState(false)
  const isNew = useArrivals(notes.map((n) => n.id))

  const [latest, ...rest] = notes
  const older = showAll ? rest : rest.slice(0, 2)
  const partnerPronoun = partner ? member(partner.user_id).pronoun : 'il'

  const send = () => {
    const body = text.trim()
    if (!body) return
    insert('notes', { body })
    setText('')
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-accent-soft via-accent-soft/40 to-transparent px-4 pb-5 pt-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">Petits mots</p>
        {latest ? (
          <NoteBody key={latest.id} note={latest} big animate={isNew(latest.id)} />
        ) : (
          <p className="font-serif text-[21px] italic leading-snug text-muted">
            Laissez un premier mot{partner ? ` à ${partner.display_name}` : ''} : {partnerPronoun} le verra en ouvrant l'app.
          </p>
        )}
      </div>

      {older.length > 0 && (
        <ul className="space-y-4 border-t border-line/70 px-4 py-4">
          {older.map((n) => (
            <li key={n.id} className="flex items-start gap-3">
              <NoteBody note={n} />
              {n.author === me && (
                <button onClick={() => remove('notes', n.id)} aria-label="Supprimer ce mot" className="grid size-6 place-items-center rounded-full text-faint active:bg-surface-2">
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
          {rest.length > 2 && (
            <li>
              <button onClick={() => setShowAll(!showAll)} className="text-[13px] font-medium text-muted">
                {showAll ? 'Réduire' : `Voir les ${rest.length - 2} autres`}
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="border-t border-line/70 p-2 [&_form]:h-12 [&_form]:shadow-none [&_form]:ring-0">
        <Composer
          value={text}
          onChange={setText}
          onSubmit={send}
          placeholder={partner ? `Un mot pour ${partner.display_name}…` : 'Écrire un mot…'}
          label="Écrire un petit mot"
          enterKeyHint="send"
          accent
        />
      </div>
    </Card>
  )
}

function NoteBody({ note, big, animate }: { note: Note; big?: boolean; animate?: boolean }) {
  const m = useMember()(note.author)
  return (
    <div className={cx('min-w-0 flex-1', animate && 'animate-pop')}>
      <p className={cx('break-words', big ? 'font-serif text-[23px] leading-[1.3]' : 'text-[15px] leading-snug')}>{big ? `« ${note.body} »` : note.body}</p>
      <p className={cx('flex items-center gap-1.5 text-muted', big ? 'mt-3 text-[13px]' : 'mt-1.5 text-[12px]')}>
        <Avatar initial={m.initial} tone={m.tone} size="xs" />
        {m.isMe ? 'Vous' : m.name} · {ago(note.created_at)}
      </p>
      <Reactions note={note} />
    </div>
  )
}

/** Réactions sous un petit mot : une par personne, un appui pour changer ou retirer. */
function Reactions({ note }: { note: Note }) {
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

  return (
    <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5">
      {list.map((r) => {
        const who = member(r.user_id)
        return (
          <button
            key={r.id}
            onClick={() => r.user_id === me && choose(r.emoji)}
            title={who.isMe ? 'Votre réaction (appuyer pour retirer)' : `${who.name} a réagi`}
            className={cx(
              'animate-pop flex h-8 items-center gap-1 rounded-full pl-2 pr-1.5 text-[15px] ring-1 transition active:scale-90',
              r.user_id === me ? 'bg-accent-soft ring-accent/30' : 'bg-surface ring-line',
            )}
          >
            {r.emoji}
            <Avatar initial={who.initial} tone={who.tone} size="xs" />
          </button>
        )
      })}
      {picking ? (
        <div className="animate-pop flex h-8 items-center gap-0.5 rounded-full bg-surface px-1 shadow-soft ring-1 ring-line">
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
          className="grid size-8 place-items-center rounded-full text-faint transition active:scale-90 active:bg-surface-2"
        >
          <SmilePlus size={17} />
        </button>
      )}
    </div>
  )
}

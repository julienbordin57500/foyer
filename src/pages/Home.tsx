import { useState, type FormEvent } from 'react'
import { ArrowUp, ChevronRight, Settings, X } from 'lucide-react'
import type { Tab } from '../App'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { ago, dueLabel, greeting, longDate } from '../lib/format'
import type { Note } from '../lib/types'
import { Avatar, Card, SectionTitle, cx } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'

export default function HomePage({ go }: { go(t: Tab): void }) {
  const { me } = useSession()
  const { data } = useStore()
  const [settings, setSettings] = useState(false)

  const groceries = data.grocery_items.filter((i) => i.status !== 'bought')
  const toOrder = groceries.filter((i) => i.drive && i.status === 'todo').length
  const todos = data.todos.filter((t) => !t.done_at)
  const mine = todos.filter((t) => t.assignee === me.user_id || t.assignee === null)
  const late = todos.filter((t) => t.due_date && dueLabel(t.due_date).late).length
  const todayCount = todos.filter((t) => t.due_date && dueLabel(t.due_date).days === 0).length

  return (
    <>
      <header className="pt-safe mb-6 flex items-start justify-between">
        <div>
          <p className="mb-1 text-[13px] font-medium text-muted first-letter:uppercase">{longDate(new Date())}</p>
          <h1 className="font-serif text-[34px] font-medium leading-none tracking-tight">
            {greeting()} {me.display_name}
          </h1>
        </div>
        <button
          onClick={() => setSettings(true)}
          aria-label="Réglages du foyer"
          className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-soft ring-1 ring-line/70 active:scale-95"
        >
          <Settings size={18} />
        </button>
      </header>

      <Notes notes={data.notes} />

      <SectionTitle>En ce moment</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Tile emoji="🧺" value={groceries.length} label={groceries.length > 1 ? 'articles à prendre' : 'article à prendre'} detail={toOrder ? `${toOrder} à commander au drive` : undefined} onClick={() => go('courses')} />
        <Tile
          emoji="📝"
          value={todos.length}
          label={todos.length > 1 ? 'choses à faire' : 'chose à faire'}
          detail={late ? `${late} en retard` : todayCount ? `${todayCount} pour aujourd'hui` : mine.length ? `${mine.length} pour moi` : undefined}
          alert={late > 0}
          onClick={() => go('afaire')}
        />
      </div>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </>
  )
}

function Tile({ emoji, value, label, detail, alert, onClick }: { emoji: string; value: number; label: string; detail?: string; alert?: boolean; onClick(): void }) {
  return (
    <button onClick={onClick} className="rounded-[24px] bg-surface p-4 text-left shadow-soft ring-1 ring-line/70 transition active:scale-[0.98]">
      <span className="flex items-center justify-between">
        <span className="text-xl">{emoji}</span>
        <ChevronRight size={16} className="text-faint" />
      </span>
      <span className="num mt-3 block font-serif text-[34px] font-medium leading-none">{value}</span>
      <span className="mt-1 block text-[13px] text-muted">{label}</span>
      {detail && <span className={cx('mt-2 block text-[12.5px] font-medium', alert ? 'text-late' : 'text-accent')}>{detail}</span>}
    </button>
  )
}

function Notes({ notes }: { notes: Note[] }) {
  const { insert, remove, me } = useStore()
  const partner = usePartner()
  const [text, setText] = useState('')
  const [showAll, setShowAll] = useState(false)

  const [latest, ...rest] = notes
  const older = showAll ? rest : rest.slice(0, 2)

  const send = (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    insert('notes', { body })
    setText('')
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-accent-soft/80 to-transparent px-5 pb-4 pt-5">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">Petits mots</p>
        {latest ? (
          <NoteBody note={latest} big />
        ) : (
          <p className="font-serif text-[20px] italic leading-snug text-muted">
            Laissez un premier mot{partner ? ` à ${partner.display_name}` : ''} : il le verra en ouvrant l'app.
          </p>
        )}
      </div>

      {older.length > 0 && (
        <ul className="space-y-3 border-t border-line/70 px-5 py-4">
          {older.map((n) => (
            <li key={n.id} className="group flex items-start gap-2.5">
              <NoteBody note={n} />
              {n.author === me && (
                <button onClick={() => remove('notes', n.id)} aria-label="Supprimer ce mot" className="mt-0.5 text-faint">
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

      <form onSubmit={send} className="flex items-center gap-2 border-t border-line/70 p-2 pl-5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder={partner ? `Un mot pour ${partner.display_name}…` : 'Écrire un mot…'}
          aria-label="Écrire un petit mot"
          enterKeyHint="send"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <button
          aria-label="Envoyer"
          disabled={!text.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition active:scale-95 disabled:opacity-25"
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </form>
    </Card>
  )
}

function NoteBody({ note, big }: { note: Note; big?: boolean }) {
  const m = useMember()(note.author)
  return (
    <div className={cx('min-w-0 flex-1', big && 'animate-pop')}>
      <p className={cx('break-words', big ? 'font-serif text-[22px] leading-snug' : 'text-[15px] leading-snug')}>
        {big ? `« ${note.body} »` : note.body}
      </p>
      <p className={cx('flex items-center gap-1.5 text-muted', big ? 'mt-3 text-[13px]' : 'mt-1 text-[12px]')}>
        <Avatar initial={m.initial} tone={m.tone} size="xs" />
        {m.isMe ? 'Vous' : m.name} · {ago(note.created_at)}
      </p>
    </div>
  )
}

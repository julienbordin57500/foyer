import { useState } from 'react'
import { ChevronRight, Settings, SmilePlus, X } from 'lucide-react'
import type { Tab } from '../App'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { ago, dueLabel, greeting, longDate } from '../lib/format'
import { REACTIONS, type Note, type Reaction } from '../lib/types'
import { Avatar, Card, Composer, Hero, HeroButton, SectionTitle, cx, useArrivals } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'
import { SearchButton } from '../components/Search'

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
  const [, ...olderNotes] = data.notes

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
        <LatestNote notes={data.notes} />
      </Hero>

      <SectionTitle>En ce moment</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          section="courses"
          emoji="🧺"
          value={groceries.length}
          label={groceries.length > 1 ? 'articles à prendre' : 'article à prendre'}
          detail={toOrder ? `${toOrder} à commander au drive` : undefined}
          onClick={() => go('courses')}
        />
        <Tile
          section="afaire"
          emoji="📝"
          value={todos.length}
          label={todos.length > 1 ? 'choses à faire' : 'chose à faire'}
          detail={
            late ? `${late} en retard` : todayCount ? `${todayCount} pour aujourd'hui` : mine.length ? `${mine.length} pour moi` : undefined
          }
          alert={late > 0}
          onClick={() => go('afaire')}
        />
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

      {olderNotes.length > 0 && <OlderNotes notes={olderNotes} />}

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  )
}

function Tile({
  section,
  emoji,
  value,
  label,
  detail,
  alert,
  onClick,
}: {
  section: Tab
  emoji: string
  value: number
  label: string
  detail?: string
  alert?: boolean
  onClick(): void
}) {
  return (
    <button
      data-section={section}
      onClick={onClick}
      className="flex min-h-[150px] flex-col rounded-[24px] bg-surface p-4 text-left shadow-soft ring-1 ring-line/60 transition duration-300 ease-smooth active:scale-[0.97]"
    >
      <span className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-sec/15 text-[18px]">{emoji}</span>
        <ChevronRight size={16} className="text-faint" />
      </span>
      <span className="num mt-auto block pt-3 font-serif text-[40px] font-medium leading-none text-sec">{value}</span>
      <span className="mt-1 block text-[13px] text-muted">{label}</span>
      <span className={cx('mt-1.5 block min-h-4 text-[12.5px] font-medium leading-4', alert ? 'text-late' : 'text-ink/80')}>{detail}</span>
    </button>
  )
}

/** Dernier petit mot, en grand dans l'en-tête, avec de quoi répondre. */
function LatestNote({ notes }: { notes: Note[] }) {
  const { insert } = useStore()
  const partner = usePartner()
  const member = useMember()
  const [text, setText] = useState('')
  const isNew = useArrivals(notes.map((n) => n.id))
  const latest = notes[0]
  const pronoun = partner ? member(partner.user_id).pronoun : 'il'

  const send = () => {
    const body = text.trim()
    if (!body) return
    insert('notes', { body })
    setText('')
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] bg-white/14 p-4 ring-1 ring-white/20 backdrop-blur-md">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">Petits mots</p>
        {latest ? (
          <NoteBody key={latest.id} note={latest} big animate={isNew(latest.id)} />
        ) : (
          <p className="font-serif text-[21px] italic leading-snug opacity-85">
            Laissez un premier mot{partner ? ` à ${partner.display_name}` : ''} : {pronoun} le verra en ouvrant l'app.
          </p>
        )}
      </div>
      <Composer
        value={text}
        onChange={setText}
        onSubmit={send}
        placeholder={partner ? `Un mot pour ${partner.display_name}…` : 'Écrire un mot…'}
        label="Écrire un petit mot"
        enterKeyHint="send"
        onHero
      />
    </div>
  )
}

function OlderNotes({ notes }: { notes: Note[] }) {
  const { remove, me } = useStore()
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? notes : notes.slice(0, 3)

  return (
    <>
      <SectionTitle
        aside={
          notes.length > 3 && <button onClick={() => setShowAll(!showAll)}>{showAll ? 'Réduire' : `Tout voir (${notes.length})`}</button>
        }
      >
        Mots précédents
      </SectionTitle>
      <Card className="overflow-hidden">
        <ul>
          {shown.map((n) => (
            <li key={n.id} className="flex items-start gap-3 border-b border-line/60 px-4 py-3.5 last:border-0">
              <NoteBody note={n} />
              {n.author === me && (
                <button
                  onClick={() => remove('notes', n.id)}
                  aria-label="Supprimer ce mot"
                  className="grid size-7 place-items-center rounded-full text-faint active:bg-surface-2"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function NoteBody({ note, big, animate }: { note: Note; big?: boolean; animate?: boolean }) {
  const m = useMember()(note.author)
  return (
    <div className={cx('min-w-0 flex-1', animate && 'animate-pop')}>
      <p className={cx('break-words', big ? 'font-serif text-[24px] leading-[1.28]' : 'text-[15px] leading-snug')}>
        {big ? `« ${note.body} »` : note.body}
      </p>
      <p className={cx('flex items-center gap-1.5', big ? 'mt-3 text-[13px] opacity-80' : 'mt-1.5 text-[12px] text-muted')}>
        <Avatar initial={m.initial} tone={m.tone} size="xs" />
        {m.isMe ? 'Vous' : m.name} · {ago(note.created_at)}
      </p>
      <Reactions note={note} glass={big} />
    </div>
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

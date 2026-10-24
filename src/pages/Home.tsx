import { useState } from 'react'
import { BellRing, ChevronRight, ListChecks, Settings, ShoppingBasket, SmilePlus, Sparkles, X } from 'lucide-react'
import type { Tab } from '../App'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { ago, dueLabel, greeting, longDate } from '../lib/format'
import { REACTIONS, type Note, type Reaction } from '../lib/types'
import { Avatar, Card, Composer, Hero, HeroButton, SectionTitle, cx, useArrivals } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'
import { SearchButton } from '../components/Search'
import { today } from '../lib/dates'

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

      <DaySummary go={go} />

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
  const groceries = data.grocery_items.filter((i) => i.status !== 'bought')
  const ping = data.pings.find((p) => p.author !== me && Date.now() - new Date(p.created_at).getTime() < 2 * 3_600_000)

  const lines: SummaryLine[] = []
  if (reminders.length)
    lines.push({
      key: 'rappels',
      section: 'afaire',
      icon: <BellRing size={17} />,
      title: `${reminders.length} rappel${reminders.length > 1 ? 's' : ''}`,
      items: reminders
        .slice(0, 3)
        .map((r) => ({ text: r.text, meta: hhmm(r.at), urgent: new Date(r.at).getTime() - Date.now() < 3_600_000 })),
    })
  if (tasks.length)
    lines.push({
      key: 'taches',
      section: 'afaire',
      icon: <ListChecks size={17} />,
      title: `${tasks.length} chose${tasks.length > 1 ? 's' : ''} à faire${late.length ? ` · ${late.length} en retard` : ''}`,
      items: tasks
        .slice(0, 3)
        .map((t) => ({ text: t.title, meta: dueLabel(t.due_date!).late ? 'en retard' : undefined, urgent: dueLabel(t.due_date!).late })),
    })
  if (groceries.length || ping) {
    const who = ping ? member(ping.author) : null
    lines.push({
      key: 'courses',
      section: 'courses',
      icon: <ShoppingBasket size={17} />,
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

  return (
    <>
      <SectionTitle>Aujourd'hui</SectionTitle>
      <Card className="overflow-hidden">
        {lines.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="grid size-10 place-items-center rounded-2xl bg-sec/15 text-sec">
              <Sparkles size={19} />
            </span>
            <span>
              <span className="block font-serif text-[19px] font-medium">Journée tranquille</span>
              <span className="block text-[13px] text-muted">Rien de prévu pour vous aujourd'hui.</span>
            </span>
          </div>
        ) : (
          <ul>
            {lines.map((l) => (
              <li key={l.key} data-section={l.section} className="border-b border-line/60 last:border-0">
                <button
                  onClick={() => go(l.section)}
                  className="flex w-full gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-2"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sec/15 text-sec">{l.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold">{l.title}</span>
                      <ChevronRight size={16} className="text-faint" />
                    </span>
                    {l.items.length > 0 && (
                      <span className="mt-1.5 block space-y-1">
                        {l.items.map((it, i) => (
                          <span key={i} className="flex items-baseline gap-2 text-[14px]">
                            {it.meta && (
                              <span className={cx('num shrink-0 text-[12.5px] font-semibold', it.urgent ? 'text-late' : 'text-sec')}>
                                {it.meta}
                              </span>
                            )}
                            <span className="truncate text-muted">{it.text}</span>
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
      </Card>
    </>
  )
}

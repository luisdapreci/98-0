'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  CircleHelp,
  Dices,
  Gauge,
  LockKeyhole,
  RotateCcw,
  Search,
  Shield,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { availablePlayers, availableSlots, DRAFT_SLOTS, rollOptions } from '../engine/draft';
import type { DraftSlot, DraftState, RerollKind } from '../engine/draft';
import { calculateSynergy } from '../engine/math';
import { balanceForRun } from '../engine/run';
import { lineupForUsagePolicy, usageCapForLineup } from '../engine/usage-policy';
import type { Coach, Player, SynergySnapshot } from '../engine/types';
import { franchises, players, useDraftStore } from '../lib/draft-store';
import { SeasonTicker } from './season-ticker';
import { DefenseBreakdown } from './defense-breakdown';

const eras = ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const slotLabel = (slot: DraftSlot) => (slot === 'SIXTH' ? '6TH' : slot);
const franchiseName = (id: string) =>
  franchises.find((franchise) => franchise.id === id)?.name ?? id;
const modifierNames = {
  fgPct: 'FG%',
  threePtPct: '3PT%',
  dbpm: 'DBPM',
  pace: 'PACE',
  usgCap: 'USG CAP',
};

function modifierLabel(modifier: Coach['modifiers'][number]) {
  const value = ['fgPct', 'threePtPct'].includes(modifier.stat)
    ? modifier.delta * 100
    : modifier.delta;
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))} ${modifierNames[modifier.stat]}`;
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-label={title}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog" title="Close">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function CoachChoices({ draft, onChoose }: { draft: DraftState; onChoose: (id: string) => void }) {
  return (
    <section className="coach-selection" aria-labelledby="coach-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PRE-DRAFT / 01</span>
          <h2 id="coach-title">CHOOSE YOUR COACH</h2>
        </div>
        <span className="muted">3 offers. One system.</span>
      </div>
      <div className="coach-grid">
        {draft.offers.map((coach, index) => (
          <article className="coach-card" key={coach.id}>
            <div className="coach-card-top">
              <span className="eyebrow">HEAD COACH</span>
              <span className="coach-number">0{index + 1}</span>
            </div>
            <div className="coach-identity">
              <h3>{coach.name}</h3>
              <p>{coach.systemName}</p>
            </div>
            <p className="coach-description">{coach.description}</p>
            <div className="modifier-list">
              {coach.modifiers.map((modifier) => (
                <span className={modifier.delta > 0 ? 'positive' : 'negative'} key={modifier.stat}>
                  {modifierLabel(modifier)}
                </span>
              ))}
            </div>
            <button
              className="coach-select"
              onClick={() => onChoose(coach.id)}
              aria-label={`Select ${coach.name}`}
            >
              SIGN COACH <ArrowRight size={18} />
            </button>
          </article>
        ))}
      </div>
      <div className="pre-draft-footer">
        <CircleDot size={20} />
        <span>
          1960s <span className="muted">/</span> 2020s
        </span>
        <span className="muted">THE ALL-TIME PLAYER POOL</span>
        <strong>
          {players.length.toLocaleString('en-US')} <span>PLAYER RECORDS</span>
        </strong>
      </div>
    </section>
  );
}

function Roster({ draft }: { draft: DraftState }) {
  const filled = DRAFT_SLOTS.filter((slot) => draft.lineup[slot]).length;
  return (
    <section className="roster-section" aria-labelledby="roster-title">
      <div className="section-heading compact">
        <h2 id="roster-title">YOUR LINEUP</h2>
        <span className="counter">
          {filled}
          <span> / 6</span>
        </span>
      </div>
      <div className="court" role="group" aria-label="Starting five">
        {DRAFT_SLOTS.filter((slot) => slot !== 'SIXTH').map((slot) => {
          const player = draft.lineup[slot];
          return (
            <div
              className={`court-position court-${slot.toLowerCase()} ${player ? 'filled' : ''}`}
              key={slot}
              data-slot={slot}
            >
              <div className="jersey">{slot}</div>
              <strong>{player?.name ?? 'Open slot'}</strong>
              <span>{player ? `${player.franchise} / ${player.decade}` : '--'}</span>
            </div>
          );
        })}
        <span className="court-wordmark" aria-hidden="true">
          98-0
        </span>
      </div>
      <div className={`bench-slot ${draft.lineup.SIXTH ? 'filled' : ''}`} data-slot="SIXTH">
        <span className="bench-badge">6TH</span>
        <div>
          <span className="eyebrow">SIXTH MAN</span>
          <strong>{draft.lineup.SIXTH?.name ?? 'Open slot'}</strong>
        </div>
        <span className="bench-detail">
          {draft.lineup.SIXTH
            ? `${draft.lineup.SIXTH.franchise} / ${draft.lineup.SIXTH.decade}`
            : 'BENCH'}
        </span>
      </div>
      <div className="roster-footer">
        <LockKeyhole size={13} />
        <span>
          {filled} {filled === 1 ? 'PICK' : 'PICKS'} LOCKED
        </span>
        <span>{6 - filled} REMAINING</span>
      </div>
    </section>
  );
}

function SynergyMeters({ synergy, draft, engineVersion }: { synergy: SynergySnapshot; draft: DraftState; engineVersion: string }) {
  const cap = usageCapForLineup(draft.lineup, engineVersion);
  const picked = DRAFT_SLOTS.some((slot) => draft.lineup[slot]);
  const usageState = synergy.usgTeam > cap ? 'OVER CAP' : 'WITHIN CAP';
  return (
    <section className="synergy-section" aria-labelledby="synergy-title">
      <div className="section-heading compact">
        <h2 id="synergy-title">TEAM CHEMISTRY</h2>
        <span className="live-label">LIVE</span>
      </div>
      <details className="chemistry-guide">
        <summary>
          <CircleHelp size={15} aria-hidden="true" />
          Stats guide
        </summary>
        <dl>
          <div>
            <dt>Usage</dt>
            <dd>
              How much your players need the ball. Stay under your coach's cap: too many
              ball-dominant scorers make the offense less efficient.
            </dd>
          </div>
          <div>
            <dt>Spacing</dt>
            <dd>
              How well your starters shoot from long range. More three-point makes pull defenders
              away from the basket, making scoring easier. Higher is better.
            </dd>
          </div>
          <div>
            <dt>Defense</dt>
            <dd>
              How well your team stops opponents from scoring. Lower is better; 110 is the game's
              average defensive rating.
            </dd>
          </div>
          <div>
            <dt>Offense</dt>
            <dd>
              Your team's scoring strength after usage and spacing bonuses or penalties. Higher is
              better.
            </dd>
          </div>
          <div>
            <dt>Net rating</dt>
            <dd>
              Overall team strength: offense minus defense. Higher is better, but even a strong team
              can lose.
            </dd>
          </div>
          <div>
            <dt>Depth</dt>
            <dd>
              The boost from your sixth man, up to +2 net rating each game. A stronger bench player
              also reduces fatigue in games on consecutive days.
            </dd>
          </div>
        </dl>
        <p>
          While drafting, empty slots contribute nothing. Judge the final ratings once all six
          players are picked. Net rating here excludes depth and game-day adjustments.
        </p>
      </details>
      <div className="meter-block">
        <div className="meter-heading">
          <span>
            <Gauge size={15} />
            USAGE
          </span>
          <strong>
            {synergy.usgTeam.toFixed(1)}
            <small>%</small>
          </strong>
        </div>
        <div
          className={`meter ${synergy.usgTeam > cap ? 'danger' : ''}`}
          role="meter"
          aria-label="Team usage"
          aria-valuenow={synergy.usgTeam}
          aria-valuemin={0}
          aria-valuemax={Math.max(200, synergy.usgTeam)}
          aria-valuetext={`${synergy.usgTeam.toFixed(1)} percent, cap ${cap}`}
        >
          <span style={{ width: `${Math.min((synergy.usgTeam / 200) * 100, 100)}%` }} />
          <i style={{ left: `${(cap / 200) * 100}%` }} />
        </div>
        <div className="meter-caption">
          <span className={synergy.usgTeam > cap ? 'negative' : ''}>
            {picked ? usageState : 'AWAITING PICKS'}
          </span>
          <span>CAP {cap}%</span>
        </div>
      </div>
      <div className="chemistry-grid">
        <div>
          <span>
            <Target size={15} />
            SPACING
          </span>
          <strong className={synergy.spacingTier === 'POOR' && picked ? 'negative' : ''}>
            {picked ? synergy.spacingTier : '--'}
          </strong>
          <small>{synergy.spacingRating.toFixed(1)} EXPECTED 3PM</small>
        </div>
        <div>
          <span>
            <Shield size={15} />
            DEFENSE
          </span>
          <strong>{picked ? synergy.drtgTeam.toFixed(1) : '--'}</strong>
          <small>DEFENSIVE RATING</small>
        </div>
      </div>
      <DefenseBreakdown lineup={draft.lineup} />
      <div className="rating-strip">
        <div>
          <span>OFFENSE</span>
          <strong>{picked ? synergy.effectiveOrtg.toFixed(1) : '--'}</strong>
        </div>
        <div>
          <span>NET RATING</span>
          <strong className={picked && synergy.netRating < 0 ? 'negative' : 'positive'}>
            {picked ? `${synergy.netRating > 0 ? '+' : ''}${synergy.netRating.toFixed(1)}` : '--'}
          </strong>
        </div>
        <div>
          <span>DEPTH</span>
          <strong>+{synergy.depthBonus.toFixed(1)}</strong>
        </div>
      </div>
    </section>
  );
}

const playerColumns = [
  { key: 'name', label: 'PLAYER / PEAK SEASONS', title: 'Player name' },
  { key: 'primaryPosition', label: 'POS', title: 'Position' },
  { key: 'pts', label: 'PTS', title: 'Points per game' },
  { key: 'reb', label: 'REB', title: 'Rebounds per game' },
  { key: 'ast', label: 'AST', title: 'Assists per game' },
  { key: 'stl', label: 'STL', title: 'Steals per game' },
  { key: 'blk', label: 'BLK', title: 'Blocks per game' },
  { key: 'fgPct', label: 'FG%', title: 'Field goal percentage' },
  { key: 'threePtPct', label: '3P%', title: 'Three-point percentage' },
  { key: 'threePtAttempts', label: '3PA', title: 'Three-point attempts per game' },
  { key: 'usgPct', label: 'USG%', title: 'Usage percentage' },
  { key: 'dbpm', label: 'DBPM', title: 'Defensive box plus/minus' },
  { key: 'overallRating', label: 'OVR', title: 'Overall rating' },
] as const;

type PlayerSortKey = (typeof playerColumns)[number]['key'];

function PlayerPool({
  draft,
  busy,
  onSelect,
}: {
  draft: DraftState;
  busy: boolean;
  onSelect: (player: Player) => void;
}) {
  const [filter, setFilter] = useState<DraftSlot | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: PlayerSortKey; ascending: boolean }>({
    key: 'overallRating',
    ascending: false,
  });
  const query = useDeferredValue(search);
  const candidates = availablePlayers(draft, players);
  const filtered = candidates.filter(
    (player) =>
      (filter === 'ALL' || filter === 'SIXTH' || player.eligiblePositions.includes(filter)) &&
      player.name.toLowerCase().includes(query.toLowerCase().trim()),
  );
  filtered.sort((first, second) => {
    const key = sort.key;
    const comparison = key === 'name' || key === 'primaryPosition'
      ? first[key].localeCompare(second[key])
      : key === 'overallRating'
        ? first.overallRating - second.overallRating
        : first.stats[key] - second.stats[key];
    return (sort.ascending ? comparison : -comparison) || first.name.localeCompare(second.name);
  });
  const SortIcon = sort.ascending ? ArrowUp : ArrowDown;
  const activeColumn = playerColumns.find((column) => column.key === sort.key)!;
  return (
    <section className="player-pool" aria-labelledby="pool-title">
      <div className="section-heading compact">
        <h2 id="pool-title">
          AVAILABLE PLAYERS <span className="count-label">{busy ? '--' : candidates.length}</span>
        </h2>
        <span className="sort-label" aria-live="polite">
          {activeColumn.label === 'PLAYER / PEAK SEASONS' ? 'PLAYER' : activeColumn.label}
          <SortIcon size={13} aria-hidden="true" />
          <span className="sr-only">{sort.ascending ? 'ascending' : 'descending'}</span>
        </span>
      </div>
      <div className="pool-controls">
        <div className="position-filter" role="group" aria-label="Filter by position">
          {(['ALL', ...DRAFT_SLOTS] as const).map((position) => (
            <button
              key={position}
              aria-pressed={filter === position}
              onClick={() => setFilter(position)}
            >
              {position === 'ALL' ? 'ALL' : slotLabel(position)}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            type="search"
            aria-label="Search players"
            placeholder="Search players"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <div
        className="player-list"
        aria-busy={busy}
        tabIndex={0}
        role="region"
        aria-label="Player stats, horizontally scrollable"
      >
        <div className="table-header player-grid">
          {playerColumns.map((column) => {
            const active = sort.key === column.key;
            const ascending = active ? !sort.ascending : column.key === 'name' || column.key === 'primaryPosition';
            const Icon = active ? SortIcon : ArrowUpDown;
            return (
              <button
                key={column.key}
                type="button"
                className="column-sort"
                aria-pressed={active}
                aria-label={`${column.title}: sort ${ascending ? 'ascending' : 'descending'}`}
                title={`${column.title}: sort ${ascending ? 'ascending' : 'descending'}`}
                onClick={() => setSort({ key: column.key, ascending })}
              >
                {column.label}
                <Icon size={11} aria-hidden="true" />
              </button>
            );
          })}
          <span />
        </div>
        {busy ? (
          <div className="pool-empty">
            <Dices size={32} className="spinning-icon" />
            <strong>SCOUTING THE ARCHIVES</strong>
          </div>
        ) : !draft.roll ? (
          <div className="pool-empty">
            <CircleDot size={38} />
            <strong>THE FLOOR IS OPEN</strong>
            <span>ROUND {DRAFT_SLOTS.filter((slot) => draft.lineup[slot]).length + 1} / 6</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="pool-empty">
            <Search size={28} />
            <strong>NO MATCHING PLAYERS</strong>
            <button
              className="text-button"
              onClick={() => {
                setFilter('ALL');
                setSearch('');
              }}
            >
              Clear filters <X size={14} />
            </button>
          </div>
        ) : (
          filtered.map((player) => {
            const legal = availableSlots(draft.lineup, player).length > 0;
            return (
              <button
                key={player.id}
                className="player-row player-grid"
                onClick={() => onSelect(player)}
                disabled={!legal}
                aria-label={`Draft ${player.name}`}
                aria-describedby={`peak-${player.id}`}
                title={legal ? `Draft ${player.name}` : 'No eligible open slot'}
              >
                <span className="player-name">
                  <strong>{player.name}</strong>
                  <small id={`peak-${player.id}`}>{player.peakYears.length}-season peak</small>
                  <small>
                    {[...player.peakYears].sort().join(' / ')}
                    {!legal ? ' / NO OPEN SLOT' : ''}
                  </small>
                </span>
                <span className="position-tag">{player.primaryPosition}</span>
                <span>{player.stats.pts.toFixed(1)}</span>
                <span>{player.stats.reb.toFixed(1)}</span>
                <span>{player.stats.ast.toFixed(1)}</span>
                <span>{player.stats.stl.toFixed(1)}</span>
                <span>{player.stats.blk.toFixed(1)}</span>
                <span>{(player.stats.fgPct * 100).toFixed(1)}</span>
                <span>{(player.stats.threePtPct * 100).toFixed(1)}</span>
                <span>{player.stats.threePtAttempts.toFixed(1)}</span>
                <span>{player.stats.usgPct.toFixed(1)}</span>
                <span>
                  {player.stats.dbpm > 0 ? '+' : ''}
                  {player.stats.dbpm.toFixed(1)}
                </span>
                <strong className="overall">{player.overallRating.toFixed(1)}</strong>
                <ChevronRight size={17} />
              </button>
            );
          })
        )}
      </div>
      <div className="pool-footer">
        <span>{busy ? 'SCOUTING' : `${filtered.length} PLAYER RECORDS`}</span>
        <span>FRANCHISE PEAKS / RAW STATS</span>
      </div>
    </section>
  );
}

export function DraftRoom() {
  const { run, notice, clearNotice, newRun, chooseCoach, spin, reroll, pick, start } = useDraftStore();
  const draft = run?.draft;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'both' | RerollKind | null>(null);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<Player | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const onStorageError = () => setError('Browser storage is unavailable or full. This run may not survive a reload.');
    window.addEventListener('98-0-storage-error', onStorageError);
    void Promise.resolve(useDraftStore.persist.rehydrate()).then(() => {
      if (!useDraftStore.getState().run) useDraftStore.getState().newRun();
      if (useDraftStore.getState().run?.phase === 'SEASON_RUNNING') useDraftStore.getState().start();
      setReady(true);
    }).catch(() => {
      setError('The saved run could not be opened. Start a new run to continue.');
      setReady(true);
    });
    return () => window.removeEventListener('98-0-storage-error', onStorageError);
  }, []);
  useEffect(() => {
    if (!busy) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 75);
    const timeout = window.setTimeout(() => setBusy(null), 750);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [busy]);
  function act(action: () => void) {
    try {
      setError('');
      action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft could not be updated.');
    }
  }
  function roll(kind?: RerollKind) {
    act(() => {
      if (kind) reroll(kind);
      else spin();
      setBusy(kind ?? 'both');
    });
  }
  const filled = draft ? DRAFT_SLOTS.filter((slot) => draft.lineup[slot]).length : 0;
  const synergy = draft && run ? calculateSynergy(lineupForUsagePolicy(draft.lineup, run.engineVersion), balanceForRun(run)) : null;
  const teamSpinning = busy === 'both' || busy === 'team';
  const eraSpinning = busy === 'both' || busy === 'era';

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="98-0 Draft Room">
          98<span>-</span>0<span className="wordmark-period">.</span>
        </a>
        <nav aria-label="Run stages">
          <span className={run?.season ? '' : 'current-stage'}>
            <span>01</span> DRAFT
          </span>
          <span className={run?.season ? 'current-stage' : ''}>
            <span>02</span> SEASON
          </span>
          <span>
            <LockKeyhole size={12} /> PLAYOFFS
          </span>
        </nav>
        <div className="topbar-right">
          <span className="mode-label">CLASSIC</span>
          <button
            className="icon-button"
            title="New run"
            aria-label="New run"
            disabled={!ready || !!busy}
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>
      <main>
        <div className="masthead">
          <div>
            <p className="eyebrow">BASKETBALL. ACROSS GENERATIONS.</p>
            <h1>
              THE DRAFT ROOM<span className="title-dot">.</span>
            </h1>
          </div>
          <div className="run-stamp">
            <Trophy size={18} />
            <span>
              THE PURSUIT OF
              <br />
              <strong>98 WINS. ZERO LOSSES.</strong>
            </span>
          </div>
        </div>
        {!ready || !draft || !synergy ? (
          <div className="loading-state" role="status">
            <CircleDot size={30} /> OPENING THE DRAFT ROOM
          </div>
        ) : (
          <>
            {(error || notice) && (
              <div className="error-banner" role="alert">
                {error || notice}
                <button
                  onClick={() => { setError(''); clearNotice(); }}
                  className="icon-button"
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {draft.phase === 'COACH' ? (
              <CoachChoices draft={draft} onChoose={(id) => act(() => chooseCoach(id))} />
            ) : (
              <>
                <div className="draft-status">
                  <div className="coach-status">
                    <Users size={19} />
                    <div>
                      <span className="eyebrow">HEAD COACH</span>
                      <strong>{draft.lineup.coach!.name}</strong>
                    </div>
                    <span className="coach-system">{draft.lineup.coach!.systemName}</span>
                  </div>
                  <div className="status-modifiers">
                    {draft.lineup.coach!.modifiers.map((modifier) => (
                      <span
                        key={modifier.stat}
                        className={modifier.delta > 0 ? 'positive' : 'negative'}
                      >
                        {modifierLabel(modifier)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="draft-grid">
                  <div className="draft-main">
                    {run?.season ? <SeasonTicker key={run.id} run={run} /> : draft.phase === 'COMPLETE' ? (
                      <section className="completion" aria-labelledby="complete-title">
                        <div className="completion-mark">
                          <Check size={30} />
                        </div>
                        <span className="eyebrow">6 PICKS / ALL LOCKED</span>
                        <h2 id="complete-title">
                          YOUR FIVE.
                          <br />
                          YOUR SIXTH.
                          <br />
                          <span>YOUR SHOT.</span>
                        </h2>
                        <div className="completion-ratings">
                          <div>
                            <span>TEAM NET RATING</span>
                            <strong>
                              {synergy.netRating > 0 ? '+' : ''}
                              {synergy.netRating.toFixed(1)}
                            </strong>
                          </div>
                          <div>
                            <span>USAGE EFFICIENCY</span>
                            <strong>{(synergy.phiUsg * 100).toFixed(1)}%</strong>
                          </div>
                        </div>
                        <button className="primary-button" disabled={run?.phase === 'SEASON_RUNNING'} onClick={() => act(start)}>
                          <ArrowRight size={18} /> {run?.phase === 'SEASON_RUNNING' ? 'SIMULATING SEASON' : 'START SEASON'}
                        </button>
                      </section>
                    ) : (
                      <>
                        <section className="reel-section" aria-label="Team and era reels">
                          <div className="section-heading compact">
                            <h2>ON THE CLOCK</h2>
                            <span className="round-label">
                              ROUND <strong>{filled + 1}</strong>
                              <span> / 6</span>
                            </span>
                          </div>
                          <div className="reel-machine">
                            <div className={`reel team-reel ${teamSpinning ? 'rolling' : ''}`}>
                              <span className="eyebrow">FRANCHISE</span>
                              <div className="reel-value" aria-hidden={!!busy}>
                                <span className="franchise-abbr">
                                  {teamSpinning
                                    ? franchises[tick % franchises.length]!.id
                                    : (draft.roll?.franchise ?? '???')}
                                </span>
                                <strong>
                                  {teamSpinning
                                    ? franchises[tick % franchises.length]!.name
                                    : draft.roll
                                      ? franchiseName(draft.roll.franchise)
                                      : 'ANY FRANCHISE'}
                                </strong>
                              </div>
                            </div>
                            <span className="reel-cross" aria-hidden="true">
                              ×
                            </span>
                            <div className={`reel era-reel ${eraSpinning ? 'rolling' : ''}`}>
                              <span className="eyebrow">ERA</span>
                              <div className="reel-value" aria-hidden={!!busy}>
                                <strong>
                                  {eraSpinning
                                    ? eras[tick % eras.length]
                                    : (draft.roll?.decade ?? '----s')}
                                </strong>
                                <span>THE DECADE</span>
                              </div>
                            </div>
                          </div>
                          <div className="reel-actions">
                            <button
                              className="primary-button"
                              disabled={!!draft.roll || !!busy}
                              onClick={() => roll()}
                            >
                              <Dices size={19} />
                              {busy ? 'SPINNING' : draft.roll ? 'PICK A PLAYER' : 'SPIN THE REELS'}
                            </button>
                            <div className="reroll-buttons">
                              {(['team', 'era'] as const).map((kind) => (
                                <button
                                  key={kind}
                                  className="reroll-button"
                                  disabled={
                                    !!busy || rollOptions(draft, players, kind).length === 0
                                  }
                                  onClick={() => roll(kind)}
                                  aria-label={`Reroll ${kind}`}
                                  title={`${kind === 'team' ? 'Team' : 'Era'} reroll: ${draft.rerolls[kind]} remaining`}
                                >
                                  <RotateCcw size={14} />
                                  <span>{kind.toUpperCase()}</span>
                                  <b>{draft.rerolls[kind]}</b>
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="sr-only" role="status">
                            {!busy && draft.roll
                              ? `Rolled ${franchiseName(draft.roll.franchise)}, ${draft.roll.decade}`
                              : busy
                                ? 'Spinning reels'
                                : `Round ${filled + 1} ready`}
                          </p>
                        </section>
                        <PlayerPool
                          key={`${draft.roll?.franchise}-${draft.roll?.decade}-${filled}`}
                          draft={draft}
                          busy={!!busy}
                          onSelect={setSelected}
                        />
                      </>
                    )}
                  </div>
                  <aside className="draft-sidebar">
                    <Roster draft={draft} />
                    <SynergyMeters draft={draft} synergy={synergy} engineVersion={run!.engineVersion} />
                  </aside>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>
          98-0 <span className="muted">/</span> THE ALL-TIME CHALLENGE
        </span>
        <span>INDEPENDENT PROJECT. NOT AFFILIATED WITH THE NBA.</span>
      </footer>
      {selected && draft && (
        <Modal title="LOCK YOUR PICK" onClose={() => setSelected(null)}>
          <div className="pick-identity">
            <span className="eyebrow">
              {franchiseName(selected.franchise)} / {selected.decade}
            </span>
            <h3>{selected.name}</h3>
            <p>
              {selected.eligiblePositions.join(' / ')} <span className="muted">·</span>{' '}
              {selected.overallRating.toFixed(1)} OVR
            </p>
            <p>
              {selected.peakYears.length}-season peak /{' '}
              {[...selected.peakYears].sort().join(' / ')}
            </p>
          </div>
          <div className="pick-stat-line">
            <div>
              <span>PTS</span>
              <strong>{selected.stats.pts}</strong>
            </div>
            <div>
              <span>REB</span>
              <strong>{selected.stats.reb}</strong>
            </div>
            <div>
              <span>AST</span>
              <strong>{selected.stats.ast}</strong>
            </div>
            <div>
              <span>USG%</span>
              <strong>{selected.stats.usgPct}</strong>
            </div>
          </div>
          <div className="slot-options">
            {availableSlots(draft.lineup, selected).map((slot) => (
              <button
                className="primary-button"
                key={slot}
                onClick={() =>
                  act(() => {
                    pick(selected.id, slot);
                    setSelected(null);
                  })
                }
              >
                <LockKeyhole size={15} /> LOCK {slotLabel(slot)}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="START A NEW RUN?" onClose={() => setConfirmReset(false)}>
          <p className="reset-message">Your current coach, picks, and rerolls will be cleared.</p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={() => setConfirmReset(false)}>
              Keep this run
            </button>
            <button
              className="primary-button"
              onClick={() => {
                newRun();
                setSelected(null);
                setError('');
                setConfirmReset(false);
              }}
            >
              <RotateCcw size={16} /> NEW RUN
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

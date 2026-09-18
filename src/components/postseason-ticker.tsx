'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Flag, FastForward, Trophy } from 'lucide-react';
import { lossExplanations, postseasonStory } from '../engine/playback';
import { playoffVenue, ROUND_LABELS } from '../engine/postseason';
import { DRAFT_SLOTS } from '../engine/draft';
import type { RunSave } from '../engine/run';
import { useDraftStore } from '../lib/draft-store';
import { GameDetails, PlaybackControls, RivalryAlert } from './season-ticker';
import { gameAudio, usePlaybackAudio } from '../lib/game-audio';

export function PostseasonTicker({ run }: { run: RunSave }) {
  const { postseasonPlayback, revealPostseason, finishPostseasonSeries, skipPostseason } = useDraftStore();
  const result = run.postseason!;
  const season = run.season!;
  const revealed = postseasonPlayback?.revealed ?? 0;
  const overtimePeriod = postseasonPlayback?.overtimePeriod ?? null;
  const visible = result.gameLog.slice(0, revealed);
  const complete = revealed === result.gameLog.length;
  const [authorizedGame, setAuthorizedGame] = useState<number | null>(null);
  const [speed, setSpeed] = useState<1 | 5>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const story = postseasonStory(result.gameLog, revealed, season.isUndefeated);
  const next = result.gameLog[revealed];
  const checkpoint = story.seriesStart || story.elimination || story.clincher;
  const playing = authorizedGame !== null && !complete && (!checkpoint || authorizedGame === next?.gameNumber);
  const current = overtimePeriod !== null ? result.gameLog[revealed] : visible.at(-1);
  const inspected = selected === null ? visible.at(-1) : visible.find((game) => game.gameNumber === selected);
  const bracketGames = visible.filter((game) => game.round !== 'playIn');
  const wins = bracketGames.filter((game) => game.won).length;
  const playInGame = visible.find((game) => game.round === 'playIn');
  const latestSeries = current ? visible.filter((game) => game.round === current.round) : [];
  const seriesWins = latestSeries.filter((game) => game.won).length;
  const preview = story.seriesStart && overtimePeriod === null ? next : null;
  const previous = visible.at(-1);
  const advanced = previous && next && previous.round !== next.round;
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  const synergy = next?.evaluation.synergy;
  const strengths = synergy ? [
    { impact: synergy.depthBonus, text: `Bench support adds ${signed(synergy.depthBonus)} net rating every game.` },
    { impact: synergy.ortgTeam * synergy.phiUsg * synergy.spacingModifier, text: `${synergy.spacingTier} spacing: ${signed(synergy.spacingModifier * 100)}% to offense.` },
    { impact: 110 - synergy.drtgTeam, text: `Defense is ${(110 - synergy.drtgTeam).toFixed(1)} points better than the 110 baseline.` },
  ].filter((item) => item.impact > 0).sort((first, second) => second.impact - first.impact) : [];
  const weaknesses = synergy && next ? [
    { impact: synergy.ortgTeam * (1 - synergy.phiUsg), text: `Usage overload reduces offense by ${((1 - synergy.phiUsg) * 100).toFixed(1)}%.` },
    { impact: -synergy.spacingModifier * synergy.ortgTeam * synergy.phiUsg, text: `Spacing reduces offense by ${(-synergy.spacingModifier * 100).toFixed(1)}%.` },
    { impact: next.context.opponentNetRating - synergy.netRating, text: `The adjusted opponent benchmark exceeds your base net rating by ${(next.context.opponentNetRating - synergy.netRating).toFixed(1)}.` },
    { impact: synergy.drtgTeam - 110, text: `Defense is ${(synergy.drtgTeam - 110).toFixed(1)} points above the 110 baseline. Lower is better.` },
  ].filter((item) => item.impact >= 1).sort((first, second) => second.impact - first.impact) : [];
  let userScore = current?.userScore ?? 0;
  let oppScore = current?.oppScore ?? 0;
  if (current && overtimePeriod !== null) {
    userScore = current.regulation.userScore + current.overtime.slice(0, overtimePeriod).reduce((total, period) => total + period.userScore, 0);
    oppScore = current.regulation.oppScore + current.overtime.slice(0, overtimePeriod).reduce((total, period) => total + period.oppScore, 0);
  }

  useEffect(() => {
    if (!playing || complete) return;
    const timer = window.setInterval(() => { if (!document.hidden) revealPostseason(); }, (overtimePeriod !== null ? 2200 : 1400) / speed);
    return () => window.clearInterval(timer);
  }, [playing, complete, speed, revealPostseason, revealed, overtimePeriod]);

  usePlaybackAudio({ revealed, overtimePeriod, playing, won: previous?.won, advanced: !!advanced,
    ending: complete ? result.isPerfectRun ? 'perfect' : result.champion ? 'champion' : 'eliminated' : undefined });

  function reveal() {
    setAuthorizedGame(null);
    setSelected(null);
    revealPostseason();
  }

  return <section className={`completion postseason-summary ${story.round === 'finals' ? 'finals-stage' : ''}`} aria-labelledby="postseason-title">
    <div className="ticker-heading"><span className="eyebrow">POSTSEASON / {revealed} GAMES FINISHED</span><span className="eyebrow">{complete ? 'FINAL' : playing ? 'LIVE' : 'PAUSED'}</span></div>
    <h2 id="postseason-title">{complete ? result.isPerfectRun ? '98-0. PERFECT.' : result.champion ? 'CHAMPIONS.' : 'RUN COMPLETE.' : 'THE PLAYOFF RUN.'}</h2>
    <div className="championship-progress">
      <span><Trophy size={18} aria-hidden="true" /> {story.bracketWins} OF 16 PLAYOFF WINS</span>
      <progress max={16} value={story.bracketWins} aria-label="Wins toward a championship" />
      {!complete && story.perfectAlive && <strong>PERFECT SEASON STILL ALIVE</strong>}
    </div>
    {complete && <div className={`postseason-outcome ${result.champion ? 'championship' : ''}`} role="status">
      {result.champion ? <div className="championship-ring"><Trophy size={56} aria-hidden="true" /><span>{result.isPerfectRun ? '98-0' : '16 WINS'}</span></div> : <Flag size={40} aria-hidden="true" />}
      <strong>{result.champion ? 'CHAMPIONSHIP RING EARNED' : `ELIMINATED / ${ROUND_LABELS[result.eliminatedRound!]}`}</strong>
      {result.isPerfectRun && <span>82-0 REGULAR SEASON + 16-0 PLAYOFFS</span>}
      <p>{result.champion ? `Led by ${run.frozenLineup?.coach?.name ?? 'your coach'}. Four series conquered.`
        : result.eliminatedRound === 'playIn' ? 'One game ended the postseason bid.'
          : result.eliminatedRound === 'finals' ? `A Finals run. ${result.series.at(-1)!.wins}-4 in the championship series.`
            : `${story.bracketWins} playoff ${story.bracketWins === 1 ? 'win' : 'wins'}. Stopped by ${previous?.opponent.name}.`}</p>
      <ul className="ring-roster">{DRAFT_SLOTS.map((slot) => <li key={slot}><span>{slot === 'SIXTH' ? '6TH' : slot}</span>{run.frozenLineup?.[slot]?.name}</li>)}</ul>
      {result.champion && <p className="defeated-opponents">Defeated: {result.series.filter((series) => series.round !== 'playIn').map((series) => `${series.opponent.name} (${series.wins}-${series.losses})`).join(' / ')}</p>}
    </div>}
    <div className="completion-ratings postseason-records">
      <div><span>REGULAR SEASON</span><strong>{season.wins}-{season.losses}</strong></div>
      {result.entry === 'PLAY_IN' && <div><span>PLAY-IN</span><strong>{playInGame ? playInGame.won ? '1-0' : '0-1' : 'PENDING'}</strong></div>}
      <div><span>MAIN BRACKET</span><strong>{wins}-{bracketGames.length - wins}</strong></div>
    </div>
    {advanced && <p className="series-advancement" role="status"><Flag size={20} aria-hidden="true" />{ROUND_LABELS[previous.round]} WON / {ROUND_LABELS[next.round]} AWAITS</p>}
    {!complete && <div className={`series-stakes ${story.elimination || story.clincher ? 'high-stakes' : ''}`} aria-live="polite">
      <span className="eyebrow">{overtimePeriod !== null ? 'IN PROGRESS' : 'UP NEXT'} / {ROUND_LABELS[next!.round]}</span>
      <h3>{story.stakes}</h3>
      <span>{next!.isHome ? 'HOME' : 'AWAY'} / {next!.opponent.name}</span>
    </div>}
    {preview && <div className="series-preview">
      <div className="series-identity">
        <span className="eyebrow">{ROUND_LABELS[preview.round]} / {preview.opponent.season} HISTORICAL SQUAD</span>
        <h3>{preview.opponent.name}</h3>
        <p>Opponent net rating {signed(preview.opponent.netRating)} / {preview.opponentMultiplier.toFixed(2)}x round difficulty / {signed(preview.context.opponentNetRating)} adjusted</p>
      </div>
      <dl className="matchup-scouting">
        <div><dt>YOUR EDGE</dt><dd>{strengths[0]?.text ?? 'No positive chemistry or bench modifier in this matchup.'}</dd></div>
        <div><dt>PRESSURE POINT</dt><dd>{weaknesses[0]?.text ?? 'No major modeled disadvantage. Upsets remain possible.'}</dd></div>
        <div><dt>OPENING MATCHUP</dt><dd>{(preview.evaluation.winProbability * 100).toFixed(1)}% win probability / {signed(preview.evaluation.deltaRating)} final rating edge</dd></div>
        <div><dt>HOME COURT</dt><dd>{preview.round === 'playIn' ? 'Sudden death on the road.' : `+3.0 net rating at home${result.entry === 'FIRST_SEED' ? `, plus +${season.wins === 82 ? 2 : 1}.0 seed bonus` : ''}. No fatigue.`}</dd></div>
      </dl>
      <ol className="venue-sequence" aria-label="Series home and away schedule">{Array.from({ length: preview.round === 'playIn' ? 1 : 7 }, (_, index) => {
        const venue = playoffVenue(result.entry, season.wins, preview.round, index + 1);
        return <li key={index} className={venue.isHome ? 'home' : ''}><span>G{index + 1}</span><strong>{venue.isHome ? 'H' : 'A'}</strong></li>;
      })}</ol>
      <RivalryAlert game={preview} lineup={run.frozenLineup} />
      <button className="primary-button series-start" onClick={() => { reveal(); gameAudio.play('start'); }}><ArrowRight size={20} aria-hidden="true" />{preview.round === 'playIn' ? 'Start Play-In' : 'Start Series'}</button>
    </div>}
    <div className="playback-controls" role="group" aria-label="Postseason playback">
      <PlaybackControls complete={complete} playing={playing} speed={speed} onPlay={() => { setSelected(null); setAuthorizedGame(playing ? null : next!.gameNumber); }} onSpeed={setSpeed}
        nextLabel={overtimePeriod !== null ? 'Next overtime period' : 'Next Game'}
        onNext={reveal} onSkip={() => { setAuthorizedGame(null); setSelected(null); skipPostseason(); }}>
        <button className="series-finish" disabled={complete} onClick={() => { setAuthorizedGame(null); setSelected(null); finishPostseasonSeries(); }}><FastForward size={18} aria-hidden="true" />Finish Series</button>
      </PlaybackControls>
    </div>
    <div className="ticker-match" role="status" aria-live="polite" aria-atomic="true">
      <span className="eyebrow">{current ? `${ROUND_LABELS[current.round]} / GAME ${current.seriesGame} / ${overtimePeriod !== null ? overtimePeriod === 0 ? 'END OF REGULATION / OVERTIME' : `END OF OT${overtimePeriod} / STILL TIED` : 'FINAL'}` : `${ROUND_LABELS[result.path[0]!.round]} / READY`}</span>
      <div className="ticker-score"><span>YOUR TEAM<strong>{current ? userScore : '--'}</strong></span><span>{current?.opponent.name ?? result.path[0]!.opponent.name}<strong>{current ? oppScore : '--'}</strong></span></div>
      <span className="eyebrow">{current ? `${current.isHome ? 'HOME' : 'AWAY'} / RESTED / SERIES ${seriesWins}-${latestSeries.length - seriesWins}` : '0-0 / RESTED'}</span>
    </div>
    {current && <RivalryAlert game={current} lineup={run.frozenLineup} />}
    <ol className="playoff-bracket" aria-label="Postseason bracket">
      {[...result.path].sort((first, second) => Number(second.round === story.round) - Number(first.round === story.round)).map(({ round, opponent }) => {
        const games = visible.filter((game) => game.round === round);
        const won = games.filter((game) => game.won).length;
        const lost = games.length - won;
        const needed = round === 'playIn' ? 1 : 4;
        const status = won === needed ? 'ADVANCED' : lost === needed ? 'ELIMINATED' : complete ? 'NOT PLAYED' : games.length ? 'IN PROGRESS' : 'PENDING';
        const activeRound = round === story.round;
        return <li key={round} className={`playoff-round ${activeRound ? 'active-round' : ''} ${won === needed ? 'won-round' : ''}`} aria-current={activeRound ? 'step' : undefined}>
          <div className="round-heading"><span className="eyebrow">{ROUND_LABELS[round]}</span><strong>{won}-{lost} / {status}</strong></div>
          <h3>{opponent.name}</h3>
          <details className="series-breakdown" open={activeRound || undefined}><summary>{activeRound ? 'SERIES GAMES' : games.length ? 'VIEW GAMES' : complete ? 'NOT PLAYED' : 'UPCOMING SERIES'}</summary>
          <div className="series-games" role="group" aria-label={`${ROUND_LABELS[round]} games`}>
            {Array.from({ length: round === 'playIn' ? 1 : 7 }, (_, index) => {
              const game = games[index];
              const active = current?.round === round && current.seriesGame === index + 1 && overtimePeriod !== null;
              return <button key={index} className={`game-node ${game ? game.won ? game.overtime.length ? 'ot-win' : 'win' : 'loss' : 'pending'}`}
                disabled={!game} aria-pressed={!!game && inspected?.gameNumber === game.gameNumber}
                aria-label={game ? `${ROUND_LABELS[round]} game ${index + 1}: ${game.won ? 'Win' : 'Loss'}, ${game.userScore} to ${game.oppScore}` : `${ROUND_LABELS[round]} game ${index + 1}: ${active ? 'overtime in progress' : 'no revealed result'}`}
                onClick={() => game && setSelected(game.gameNumber)}><span>{index + 1}</span><strong>{game ? `${game.won ? 'W' : 'L'}${game.overtime.length ? ' OT' : ''}` : active ? 'OT' : '--'}</strong></button>;
            })}
          </div></details>
        </li>;
      })}
    </ol>
    {(story.moments.length > 0 || complete) && <div className="postseason-retrospective">
      <h3>{complete ? 'THE RUN, REMEMBERED.' : 'DEFINING MOMENTS'}</h3>
      {story.closest && complete && <p>Closest game: {ROUND_LABELS[story.closest.round]}, Game {story.closest.seriesGame} against {story.closest.opponent.name}. {story.closest.won ? 'Won' : 'Lost'} {story.closest.userScore}-{story.closest.oppScore}.</p>}
      <ul>{story.moments.map((moment, index) => <li key={`${moment.round}-${index}`}><span className="eyebrow">{ROUND_LABELS[moment.round]}</span>{moment.text}</li>)}</ul>
      {complete && !result.champion && previous && <div className="elimination-review"><h4>FINAL MATCHUP</h4><p className="autopsy-caveat">Model disadvantages, not proven causes of this loss.</p><ul>{lossExplanations(previous).map((text) => <li key={text}>{text}</li>)}</ul></div>}
    </div>}
    {inspected && <details className="season-log" open={selected !== null || undefined}><summary>{ROUND_LABELS[inspected.round]} / GAME {inspected.seriesGame}</summary>
      {!inspected.won && <><p className="autopsy-caveat">Model disadvantages, not proven causes of this loss.</p><ul>{lossExplanations(inspected).map((text) => <li key={text}>{text}</li>)}</ul></>}
      <GameDetails game={inspected} lineup={run.frozenLineup} chemistryDisabled={run.iqMode === 'no'} />
    </details>}
    <details className="season-log run-details"><summary>POSTSEASON RULES</summary><dl><dt>RULES / RIVALRIES</dt><dd>{result.version} / {run.rivalryVersion ?? 'none (legacy run)'}</dd><dt>SEED</dt><dd>{run.seed}</dd></dl></details>
  </section>;
}
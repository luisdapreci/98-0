'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, StepForward, Volume2, VolumeX } from 'lucide-react';
import { isPerfectSeasonChase, lossExplanations, visibleStandings } from '../engine/playback';
import { qualificationWinsForEngine } from '../engine/postseason-policy';
import type { RunSave } from '../engine/run';
import type { SeasonGame } from '../engine/types';
import { useDraftStore } from '../lib/draft-store';
import { DefenseBreakdown } from './defense-breakdown';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
const entryLabels = {
  MISSED: 'MISSED QUALIFICATION', PLAY_IN: 'PLAY-IN QUALIFIED', FOURTH_SEED: '4TH SEED QUALIFIED',
  SECOND_SEED: '2ND SEED QUALIFIED', FIRST_SEED: '1ST SEED QUALIFIED',
};

function GameDetails({ game }: { game: SeasonGame }) {
  const { evaluation } = game;
  const { synergy } = evaluation;
  return (
    <div className="game-details">
      <h3>GAME {game.gameNumber} / {game.opponent.name}</h3>
      <p>{game.won ? 'WIN' : 'LOSS'} / {game.userScore} - {game.oppScore} / {game.isHome ? 'HOME' : 'AWAY'}</p>
      <p className="muted">{game.opponent.tier} / Day {game.day}{game.pairId !== null ? ` / B2B pair ${game.pairId}, leg ${game.leg}` : ' / Rested'}{game.isBackToBack ? ' / Fatigued second leg' : ''}</p>
      {game.events.includes('ONE_POINT_FINISH') && <p>ONE-POINT FINISH</p>}
      {game.overtime.length > 0 && <p>Regulation: {game.regulation.userScore} - {game.regulation.oppScore}{game.overtime.map((period, index) => <span key={index}> / OT{index + 1}: +{period.userScore} - +{period.oppScore}</span>)}</p>}
      <dl className="game-context">
        <div><dt>Pre-game win probability</dt><dd>{(evaluation.winProbability * 100).toFixed(1)}%</dd></div>
        <div><dt>Team net rating</dt><dd>{signed(synergy.netRating)}</dd></div>
        <div><dt>Opponent net rating</dt><dd>{signed(game.context.opponentNetRating)}</dd></div>
        <div><dt>Home court</dt><dd>{signed(evaluation.homeCourtBonus)}</dd></div>
        <div><dt>B2B fatigue</dt><dd>{signed(evaluation.fatigueModifier)}</dd></div>
        <div><dt>Sixth-man depth bonus</dt><dd>{signed(synergy.depthBonus)}</dd></div>
        <div><dt>Coach pace</dt><dd>{signed(evaluation.coachPaceModifier)}</dd></div>
        <div><dt>Final rating advantage</dt><dd>{signed(evaluation.deltaRating)}</dd></div>
        <div><dt>Usage multiplier</dt><dd>{synergy.phiUsg.toFixed(3)}</dd></div>
        <div><dt>Spacing modifier</dt><dd>{signed(synergy.spacingModifier * 100)}%</dd></div>
        <div><dt>Effective offense / defense</dt><dd>{synergy.effectiveOrtg.toFixed(2)} / {synergy.drtgTeam.toFixed(2)}</dd></div>
      </dl>
    </div>
  );
}

export function SeasonTicker({ run }: { run: RunSave }) {
  const { playback, revealNext, skipSeason } = useDraftStore();
  const season = run.season!;
  const revealed = playback?.revealed ?? season.gameLog.length;
  const overtimePeriod = playback?.overtimePeriod ?? null;
  const standings = visibleStandings(season.gameLog, revealed);
  const complete = revealed === season.gameLog.length;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 5>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const current = overtimePeriod !== null ? season.gameLog[revealed] : standings.gameLog.at(-1);
  const inspected = selected === null ? standings.gameLog.at(-1) : standings.gameLog[selected];
  const tension = isPerfectSeasonChase(revealed, standings.losses, season.gameLog.length);
  let userScore = current?.userScore ?? 0;
  let oppScore = current?.oppScore ?? 0;
  if (current && overtimePeriod !== null) {
    userScore = current.regulation.userScore;
    oppScore = current.regulation.oppScore;
    for (const period of current.overtime.slice(0, overtimePeriod)) {
      userScore += period.userScore;
      oppScore += period.oppScore;
    }
  }

  useEffect(() => {
    if (!playing || complete) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) revealNext();
    }, 1200 / speed);
    return () => window.clearInterval(timer);
  }, [playing, complete, speed, revealNext]);

  useEffect(() => () => { void audio.current?.close(); }, []);

  useEffect(() => {
    const context = audio.current;
    if (!audioEnabled || !playing || !tension || document.hidden || !context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 80;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    return () => { gain.gain.cancelScheduledValues(context.currentTime); gain.gain.value = 0; };
  }, [audioEnabled, playing, tension, revealed]);

  async function toggleAudio() {
    if (audioEnabled) { setAudioEnabled(false); return; }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setAudioEnabled(true);
      setAudioError('');
    } catch { setAudioError('Audio is unavailable in this browser.'); }
  }

  return (
    <section className={`completion season-summary ${tension ? 'streak-tension' : ''}`} aria-labelledby="season-title">
      <div className="ticker-heading">
        <span className="eyebrow">REGULAR SEASON / {revealed} OF 82</span>
        <span className="eyebrow">{complete ? 'FINAL' : playing ? 'LIVE' : 'PAUSED'}</span>
      </div>
      <h2 id="season-title">{standings.wins} W <span>/ {standings.losses} L</span></h2>
      <p className="ticker-status">{complete ? season.isUndefeated ? '82-0 / UNDEFEATED' : entryLabels[season.postseasonEntry] : tension ? `${standings.wins}-0 / THE PERFECT SEASON IS STILL ALIVE` : `${standings.currentStreak} GAME WIN STREAK`}</p>
      <div className="playback-controls" role="group" aria-label="Season playback">
        <button className="icon-button" disabled={complete} onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause season' : 'Play season'} title={playing ? 'Pause season' : 'Play season'}>{playing && !complete ? <Pause size={20} /> : <Play size={20} />}</button>
        <div className="playback-speed" role="group" aria-label="Playback speed">
          {([1, 5] as const).map((value) => <button key={value} aria-pressed={speed === value} onClick={() => setSpeed(value)} aria-label={`${value}x speed`}>{value}x</button>)}
        </div>
        <button className="icon-button" disabled={complete} onClick={() => { setPlaying(false); revealNext(); }} aria-label="Next reveal" title="Next reveal"><StepForward size={20} /></button>
        <button className="icon-button" disabled={complete} onClick={() => { setPlaying(false); skipSeason(); }} aria-label="Skip to final result" title="Skip to final result"><SkipForward size={20} /></button>
        <button className="icon-button" onClick={() => void toggleAudio()} aria-pressed={audioEnabled} aria-label={audioEnabled ? 'Mute streak audio' : 'Enable streak audio'} title={audioEnabled ? 'Mute streak audio' : 'Enable streak audio'}>{audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
      </div>
      {audioError && <p role="status">{audioError}</p>}
      <div className="ticker-match" role="status" aria-live="polite" aria-atomic="true">
        <span className="eyebrow">{current ? `GAME ${current.gameNumber} / ${overtimePeriod !== null ? overtimePeriod === 0 ? 'END OF REGULATION / OVERTIME' : `END OF OT${overtimePeriod} / STILL TIED` : `FINAL${current.overtime.length ? ` / ${current.overtime.length}OT` : ''}`}` : 'SEASON READY'}</span>
        <div className="ticker-score"><span>YOUR TEAM<strong>{current ? userScore : '--'}</strong></span><span>{current?.opponent.name ?? '82-GAME GAUNTLET'}<strong>{current ? oppScore : '--'}</strong></span></div>
        <span className="eyebrow">{current ? `${current.isHome ? 'HOME' : 'AWAY'} / ${current.isBackToBack ? 'B2B SECOND LEG' : 'RESTED'}${overtimePeriod === null ? ` / ${current.won ? 'WIN' : 'LOSS'}` : ''}` : '0 W / 0 L'}</span>
      </div>
      <ol className="season-timeline" aria-label="82-game timeline">
        {season.gameLog.map((game, index) => {
          const visible = index < revealed;
          const activeOvertime = index === revealed && overtimePeriod !== null;
          const result = visible ? `${game.won ? 'W' : 'L'}${game.overtime.length ? ' OT' : ''}` : activeOvertime ? 'OT' : '--';
          return <li key={game.gameNumber}><button
            className={`game-node ${visible ? game.won ? game.overtime.length ? 'ot-win' : 'win' : 'loss' : 'pending'}`}
            disabled={!visible}
            aria-label={visible ? `Game ${game.gameNumber}: ${result}, ${game.userScore} to ${game.oppScore}, ${game.opponent.name}` : `Game ${game.gameNumber}: ${activeOvertime ? 'overtime in progress' : 'not revealed'}`}
            aria-pressed={visible && inspected?.gameNumber === game.gameNumber}
            onClick={() => setSelected(index)}
          ><span>{game.gameNumber}</span><strong>{result}</strong></button></li>;
        })}
      </ol>
      <div className="completion-ratings">
        <div><span>POINT DIFFERENTIAL</span><strong>{standings.pointDifferential > 0 ? '+' : ''}{standings.pointDifferential}</strong></div>
        <div><span>LONGEST WIN STREAK</span><strong>{standings.longestStreak}</strong></div>
      </div>
      {complete && <p className="completion-note">{season.qualified ? 'Qualified. Postseason is not available yet.' : `Regular season complete. Below the ${qualificationWinsForEngine(run.engineVersion)}-win qualification threshold.`}</p>}
      {standings.firstLoss && <details className="season-log loss-autopsy" open>
        <summary>FIRST LOSS / GAME {standings.firstLoss.gameNumber}</summary>
        <p className="autopsy-caveat">Model disadvantages, not proven causes of this loss.</p>
        <ul>{lossExplanations(standings.firstLoss).map((explanation) => <li key={explanation}>{explanation}</li>)}</ul>
        <GameDetails game={standings.firstLoss} />
        {run.frozenLineup && <DefenseBreakdown lineup={run.frozenLineup} />}
      </details>}
      {inspected && <details className="season-log" open><summary>GAME DETAILS / {inspected.gameNumber}</summary><GameDetails game={inspected} /></details>}
      <details className="season-log">
        <summary>GAME LOG / {revealed} FINISHED</summary>
        <div className="season-table-scroll" tabIndex={0} role="region" aria-label="Revealed regular-season results">
          <table>
            <thead><tr><th scope="col">GAME</th><th scope="col">OPPONENT</th><th scope="col">VENUE</th><th scope="col">RESULT</th><th scope="col">SCORE</th></tr></thead>
            <tbody>{standings.gameLog.map((game) => <tr key={game.gameNumber}>
              <td><button className="game-log-link" onClick={() => setSelected(game.gameNumber - 1)} aria-label={`Inspect game ${game.gameNumber}`}>{game.gameNumber}</button>{game.isBackToBack ? ' B2B' : ''}</td>
              <td>{game.opponent.name}</td><td>{game.isHome ? 'HOME' : 'AWAY'}</td>
              <td className={game.won ? 'positive' : 'negative'}>{game.won ? 'W' : 'L'}{game.overtime.length ? ` / ${game.overtime.length}OT` : ''}</td>
              <td>{game.userScore} - {game.oppScore}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
      <details className="season-log run-details"><summary>RUN DETAILS</summary>
        <dl><dt>SEED / RUN ID</dt><dd>{run.seed}</dd><dt>ENGINE / DATA</dt><dd>{run.engineVersion} / {run.dataVersion}</dd><dt>SCORE / RANDOM</dt><dd>{run.scoreVersion} / {run.randomVersion}</dd>{run.legacyDraft && <><dt>ORIGIN</dt><dd>Restored unseeded draft</dd></>}</dl>
      </details>
    </section>
  );
}
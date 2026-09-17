'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, FileText, Share2, Trophy } from 'lucide-react';
import type { Coach, IQMode } from '../engine/types';
import { resultText } from '../engine/progress';
import type { Progress, RunSummary } from '../engine/progress';

const modifierNames = { fgPct: 'FG%', threePtPct: '3PT%', dbpm: 'DBPM', pace: 'PACE', usgCap: 'USG CAP' };
const roundNames = { playIn: 'PLAY-IN', round1: 'ROUND 1', round2: 'ROUND 2', conferenceFinals: 'CONFERENCE FINALS', finals: 'FINALS' };

export function CoachAlmanac({ coaches, noChemistry }: { coaches: Coach[]; noChemistry: boolean }) {
  return <div className="almanac">
    <p className="collection-label">12 SYSTEMS / UNLOCKED{noChemistry ? ' / EFFECTS INACTIVE IN NO IQ' : ''}</p>
    {coaches.map((coach, index) => <article className="almanac-entry" key={coach.id}>
      <span className="almanac-number">{String(index + 1).padStart(2, '0')}</span>
      <div><h3>{coach.name}</h3><strong>{coach.systemName}</strong><p>{coach.description}</p>
        <div className="almanac-modifiers">{coach.modifiers.map((modifier) => {
          const value = Number((modifier.delta * (['fgPct', 'threePtPct'].includes(modifier.stat) ? 100 : 1)).toFixed(2));
          return <span key={modifier.stat} className={value > 0 ? 'positive' : 'negative'}>{value > 0 ? '+' : ''}{value} {modifierNames[modifier.stat]}</span>;
        })}</div>
      </div>
    </article>)}
  </div>;
}

function statusLabel(result: RunSummary): string {
  if (result.postseason?.isPerfectRun) return '98-0. PERFECT.';
  if (result.postseason?.champion) return 'CHAMPIONS.';
  if (result.postseasonStatus === 'pending') return 'POSTSEASON PENDING';
  if (result.postseasonStatus === 'missed') return 'MISSED POSTSEASON';
  return `ELIMINATED / ${result.postseason?.eliminatedRound ? roundNames[result.postseason.eliminatedRound] : 'POSTSEASON'}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function ShareResult({ result, onBack }: { result: RunSummary; onBack: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLTextAreaElement>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [imageError, setImageError] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const text = resultText(result);
  const filename = `98-0-${result.mode}-${result.daily?.date ?? new Date(result.completedAt).toISOString().slice(0, 10)}`;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await document.fonts.ready;
        const { toBlob } = await import('html-to-image');
        if (cancelled || !card.current) return;
        const exportCard = card.current.cloneNode(true) as HTMLDivElement;
        Object.assign(exportCard.style, { position: 'fixed', left: '-10000px', top: '0', width: '720px', maxWidth: 'none', padding: '32px', pointerEvents: 'none' });
        exportCard.setAttribute('aria-hidden', 'true');
        document.body.append(exportCard);
        try {
          const blob = await toBlob(exportCard, { pixelRatio: 2, width: 720, backgroundColor: '#131614',
            style: { position: 'static', left: 'auto', top: 'auto' } });
          if (!blob) throw new Error('Empty image');
          if (!cancelled) setImage(blob);
        } finally { exportCard.remove(); }
      } catch {
        if (!cancelled) setImageError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function selectText(message: string) {
    fallback.current?.focus();
    fallback.current?.select();
    setFeedback(message);
  }
  async function copy() {
    setBusy(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setFeedback('Result text copied.');
    } catch {
      selectText('Clipboard unavailable. Result text selected; text download is available.');
    } finally { setBusy(false); }
  }
  async function share() {
    setBusy(true);
    try {
      if (!navigator.share) {
        selectText('Sharing unavailable. Result text selected; image and text downloads are available.');
        return;
      }
      const file = image ? new File([image], `${filename}.png`, { type: 'image/png' }) : null;
      await navigator.share(file && navigator.canShare?.({ files: [file] })
        ? { files: [file], title: '98-0', text } : { title: '98-0', text });
      setFeedback('Result shared.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') setFeedback('Share cancelled.');
      else selectText('Sharing failed. Result text selected; image and text downloads are available.');
    } finally { setBusy(false); }
  }
  return <div className="share-result">
    <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> HISTORY</button>
    <div className="share-card" ref={card}>
      <div className="share-brand"><strong>98<span>-</span>0.</strong><span>{result.mode.toUpperCase()} IQ</span><Trophy size={28} /></div>
      {result.daily && <p className="share-daily">DAILY / {result.daily.date} UTC / {result.daily.kind.toUpperCase()}</p>}
      <h3>{statusLabel(result)}</h3>
      <div className="share-records">
        <div><span>REGULAR SEASON</span><strong>{result.season.wins}-{result.season.losses}</strong></div>
        <div><span>PLAYOFFS</span><strong className={!result.postseason ? 'share-pending' : undefined}>{result.postseason ? `${result.postseason.playoffs.wins}-${result.postseason.playoffs.losses}` : result.postseasonStatus === 'pending' ? 'PENDING' : 'N/A'}</strong></div>
      </div>
      <p className="share-detail">DIFF {result.season.differential > 0 ? '+' : ''}{result.season.differential} / BEST STREAK {result.season.streak}</p>
      <p className="share-detail">PLAY-IN {result.postseason ? `${result.postseason.playIn.wins}-${result.postseason.playIn.losses}` : result.postseasonStatus === 'pending' ? 'PENDING' : 'N/A'}</p>
      <div className="share-coach"><span>HEAD COACH</span><strong>{result.coach.name}</strong><p>{result.coach.systemName}</p></div>
      <ul className="share-lineup">{result.lineup.map((player) => <li key={player.slot}>
        <span>{player.slot === 'SIXTH' ? '6TH' : player.slot}</span>
        <strong>{player.name}</strong><small>{player.franchise} / {player.decade}</small>
      </li>)}</ul>
      <p className="share-disclaimer">LOCAL RESULT / NOT VERIFIED / NOT A RANKING</p>
    </div>
    <div className="share-actions">
      <button className="primary-button" disabled={!image || busy} onClick={() => {
        try { downloadBlob(image!, `${filename}.png`); setFeedback('Image download started.'); }
        catch { setFeedback('Image download failed. Result text remains available.'); }
      }}><Download size={17} /> IMAGE</button>
      <button className="secondary-button" disabled={busy} onClick={() => void copy()}><Copy size={17} /> COPY TEXT</button>
      <button className="secondary-button" disabled={busy} onClick={() => void share()}><Share2 size={17} /> SHARE</button>
      <button className="secondary-button" onClick={() => {
        try { downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filename}.txt`); setFeedback('Text download started.'); }
        catch { selectText('Download failed. Result text selected.'); }
      }}><FileText size={17} /> TEXT FILE</button>
    </div>
    <p className="share-feedback" role="status">{feedback || (imageError ? 'Image export failed. Text sharing and download remain available.' : image ? 'Image ready.' : 'Rendering image...')}</p>
    <label className="collection-label" htmlFor="result-text">RESULT TEXT</label>
    <textarea id="result-text" ref={fallback} readOnly value={text} rows={8} />
  </div>;
}

export function RunHistory({ progress, initialId }: { progress: Progress; initialId: string | null }) {
  const [selected, setSelected] = useState<RunSummary | null>(() => progress.runs.find((run) => run.id === initialId) ?? null);
  const [mode, setMode] = useState<IQMode | 'all'>('all');
  const [view, setView] = useState<'recent' | 'best'>('recent');
  if (selected) return <ShareResult key={`${selected.id}:${selected.postseasonStatus}`} result={selected} onBack={() => setSelected(null)} />;
  const entries = view === 'recent' ? progress.runs.map((run) => ({ run, label: new Date(run.completedAt).toLocaleDateString() }))
    : (['no', 'mid', 'hi'] as const).flatMap((mode) => {
      const best = progress.bests[mode];
      return best ? [ { run: best.record, label: 'MOST WINS' }, { run: best.differential, label: 'BEST DIFFERENTIAL' }, { run: best.streak, label: 'LONGEST WIN STREAK' } ] : [];
    });
  const filtered = entries.filter(({ run }) => mode === 'all' || run.mode === mode);
  return <div className="run-history">
    <p className="collection-label">LOCAL ONLY / {progress.runs.length} OF 50 RECENT RUNS</p>
    <div className="result-tabs" role="group" aria-label="History view">
      <button aria-pressed={view === 'recent'} onClick={() => setView('recent')}>RECENT</button>
      <button aria-pressed={view === 'best'} onClick={() => setView('best')}>PERSONAL BESTS</button>
    </div>
    <div className="history-modes" role="group" aria-label="History IQ mode">
      {(['all', 'no', 'mid', 'hi'] as const).map((value) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'all' ? 'ALL' : `${value.toUpperCase()} IQ`}</button>)}
    </div>
    {!filtered.length && <p className="collection-empty">No completed seasons{mode === 'all' ? '' : ` in ${mode.toUpperCase()} IQ`}.</p>}
    <ol className="history-list">{filtered.map(({ run, label }) => <li key={`${run.id}:${label}`}>
      <button onClick={() => setSelected(run)} aria-label={`View result: ${run.coach.name}, ${run.season.wins}-${run.season.losses}, ${run.mode.toUpperCase()} IQ, ${label}`}>
        <span className="history-record">{run.season.wins}<small>-{run.season.losses}</small></span>
        <span className="history-identity"><small>{label} / {run.mode.toUpperCase()} IQ</small><strong>{run.coach.name}</strong><span>{statusLabel(run)}</span>
          {run.daily && <small>DAILY {run.daily.date} / {run.daily.kind.toUpperCase()}</small>}
          <small>DIFF {run.season.differential} / STREAK {run.season.streak}</small>
        </span>
        {run.postseason?.champion ? <Trophy size={20} /> : <Check size={18} />}
      </button>
    </li>)}</ol>
  </div>;
}
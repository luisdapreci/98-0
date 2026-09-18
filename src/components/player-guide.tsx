'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, CircleHelp, X } from 'lucide-react';

const guideKey = '98-0-guide-v1';

export function PlayerGuide() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(guideKey) === 'dismissed';
    } catch {}
    if (!dismissed) dialog.current?.showModal();
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(guideKey, 'dismissed');
    } catch {}
    dialog.current?.close();
    trigger.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={trigger} className="icon-button" title="How to play" aria-label="How to play"
      aria-haspopup="dialog" aria-controls="player-guide" onClick={() => dialog.current?.showModal()}>
      <CircleHelp size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} id="player-guide" className="dialog player-guide" aria-labelledby="player-guide-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <div className="dialog-heading">
        <h2 id="player-guide-title">HOW TO PLAY 98-0</h2>
        <button className="icon-button" title="Close guide" aria-label="Close guide" onClick={dismiss} autoFocus>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <p className="guide-goal">Build a team from NBA history. Chase <strong>82 season wins + 16 playoff wins = 98-0.</strong></p>
      <ol className="guide-steps">
        <li><h3>SIGN YOUR COACH</h3><p>Choose an IQ mode, then sign a coach. Mid IQ is the default: build around your coach&apos;s system, with scouting visible.</p></li>
        <li><h3>DRAFT YOUR SIX</h3><p>Spin the Team and Era reels to reveal players. Pick a player and an open eligible position. Fill five starters and one sixth man. Use your limited team and era rerolls when you need different options.</p></li>
        <li><h3>BUILD A TEAM THAT FITS</h3><p>Balance scoring, shooting, defense and bench strength. In Mid and HI IQ, too many ball-dominant scorers can overload your offense; chemistry and coach fit matter.</p></li>
        <li><h3>CHASE THE RING</h3><p>Start the season once your lineup is full. Reveal all 82 games; new runs need 45 wins to qualify for the postseason. Survive the play-in if needed, then win four playoff series. A perfect 98-0 needs an 82-0 season and no play-in.</p></li>
      </ol>
      <dl className="guide-modes">
        <div><dt>NO IQ</dt><dd>Individual talent and bench quality. No chemistry or coach effects.</dd></div>
        <div><dt>HI IQ</dt><dd>Mid IQ rules, but scouting stays hidden until Start Season.</dd></div>
        <div><dt>DAILY</dt><dd>A themed Mid IQ challenge each UTC day. Your first attempt counts locally; retries are practice.</dd></div>
      </dl>
      <p className="guide-note">Progress stays in this browser. Reloading does not reroll results. Complete a season to unlock the Coach Almanac.</p>
      <div className="dialog-actions">
        <button className="primary-button" onClick={dismiss}>LET&apos;S PLAY <ArrowRight size={18} aria-hidden="true" /></button>
      </div>
    </dialog>
  </>;
}
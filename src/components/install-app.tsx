'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const prompt = useRef<InstallPromptEvent | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [available, setAvailable] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState<'ios' | 'error' | null>(null);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const appleNavigator = navigator as Navigator & { standalone?: boolean };
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIos(isIos && /Safari/.test(navigator.userAgent)
      && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent));
    const syncDisplayMode = () => setInstalled(displayMode.matches || appleNavigator.standalone === true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPromptEvent;
      setAvailable(true);
    };
    const onInstalled = () => {
      prompt.current = null;
      setAvailable(false);
      setInstalled(true);
      setMessage(null);
    };
    syncDisplayMode();
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', syncDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', syncDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (message) dialog.current?.showModal();
    else dialog.current?.close();
  }, [message]);

  async function install() {
    const pending = prompt.current;
    if (!pending) {
      if (ios) setMessage('ios');
      return;
    }
    prompt.current = null;
    setAvailable(false);
    try {
      await pending.prompt();
      if ((await pending.userChoice).outcome === 'accepted') setInstalled(true);
    } catch {
      setMessage('error');
    }
  }

  return (
    <>
      {!installed && (available || ios) && (
        <button className="icon-button install-app" title="Install 98-0" aria-label="Install 98-0" onClick={install}>
          <Download size={18} /><span>INSTALL</span>
        </button>
      )}
      <dialog ref={dialog} className="dialog install-dialog" aria-label="Install 98-0" onCancel={() => setMessage(null)}>
        <div className="dialog-heading">
          <h2>INSTALL 98-0</h2>
          <button className="icon-button" title="Close" aria-label="Close install dialog" onClick={() => setMessage(null)}>
            <X size={20} />
          </button>
        </div>
        {message === 'ios' ? (
          <p>In Safari, tap <Share2 size={16} aria-hidden="true" /> <strong>Share</strong>, then <strong>Add to Home Screen</strong> and <strong>Add</strong>. Leave <strong>Open as Web App</strong> on if shown.</p>
        ) : message === 'error' ? (
          <p>Installation could not open. Try your browser&apos;s install menu, or continue playing here.</p>
        ) : null}
      </dialog>
    </>
  );
}
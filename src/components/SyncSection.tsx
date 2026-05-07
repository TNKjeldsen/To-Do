import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { useSync } from '../state/AppStateContext';
import {
  clearSyncConfig,
  generateSyncKey,
  loadSyncConfig,
  normaliseWorkerUrl,
  probeWorker,
  saveSyncConfig,
  SYNC_KEY_RE,
  type SyncState,
} from '../state/sync';
import { Icon } from './Icon';

function statusLabel(state: SyncState, configured: boolean): string {
  if (!configured) return 'Ikke konfigureret';
  switch (state.kind) {
    case 'idle':
      return 'Klar';
    case 'pulling':
      return 'Henter…';
    case 'pushing':
      return 'Sender…';
    case 'success': {
      const when = format(new Date(state.at), 'HH:mm:ss', { locale: da });
      switch (state.direction) {
        case 'pull':
          return `Hentet ${when}`;
        case 'push':
          return `Sendt ${when}`;
        case 'noop':
          return `Synkroniseret ${when}`;
      }
      return `Synkroniseret ${when}`;
    }
    case 'error':
      return 'Fejl';
  }
}

function statusColor(state: SyncState, configured: boolean): string {
  if (!configured) return 'bg-slate-500';
  if (state.kind === 'pulling' || state.kind === 'pushing') return 'bg-amber-400 animate-pulse';
  if (state.kind === 'error') return 'bg-red-500';
  if (state.kind === 'success') return 'bg-emerald-500';
  return 'bg-slate-400';
}

export function SyncSection() {
  const { syncConfig, syncState, refreshSyncConfig, triggerPull, triggerPush } = useSync();

  const [editing, setEditing] = useState<boolean>(false);
  const [workerUrl, setWorkerUrl] = useState('');
  const [syncKey, setSyncKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [probing, setProbing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form when entering edit mode.
  useEffect(() => {
    if (editing) {
      const current = loadSyncConfig();
      setWorkerUrl(current?.workerUrl ?? '');
      setSyncKey(current?.syncKey ?? '');
      setFormError(null);
    }
  }, [editing]);

  const handleGenerate = () => {
    setSyncKey(generateSyncKey());
  };

  const handleSave = async () => {
    setFormError(null);
    const url = normaliseWorkerUrl(workerUrl);
    if (!url) {
      setFormError('Indtast Worker-URL');
      return;
    }
    if (!SYNC_KEY_RE.test(syncKey)) {
      setFormError(
        'Sync-nøgle skal være 16-128 tegn (bogstaver, tal, bindestreg, underscore)'
      );
      return;
    }
    setProbing(true);
    try {
      await probeWorker(url);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? `Kunne ikke nå worker: ${err.message}`
          : 'Kunne ikke nå worker'
      );
      setProbing(false);
      return;
    }
    setProbing(false);
    saveSyncConfig({ workerUrl: url, syncKey });
    refreshSyncConfig();
    setEditing(false);
  };

  const handleClear = () => {
    if (
      window.confirm(
        'Slå sync fra? Lokale data bevares, men appen vil ikke længere synkronisere.'
      )
    ) {
      clearSyncConfig();
      refreshSyncConfig();
    }
  };

  const handleCopy = async () => {
    if (!syncConfig) return;
    try {
      await navigator.clipboard.writeText(syncConfig.syncKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — older browsers without clipboard API
    }
  };

  const configured = syncConfig !== null;
  const dotClass = statusColor(syncState, configured);
  const label = statusLabel(syncState, configured);

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Sync
      </h3>

      <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
          <span className="font-medium">{label}</span>
        </div>

        {syncState.kind === 'error' ? (
          <div className="text-xs text-red-300 mb-2">{syncState.message}</div>
        ) : null}

        {!configured && !editing ? (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Synkronisér mellem dine enheder via en gratis Cloudflare Worker.
              Følg vejledningen i <span className="font-mono text-[11px]">worker/README.md</span>{' '}
              for at deploye den (engangs-opsætning, ~5 min).
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-3 py-2 rounded-md bg-sky-500 text-white text-sm hover:bg-sky-400"
            >
              Konfigurér sync
            </button>
          </>
        ) : null}

        {configured && !editing ? (
          <>
            <div className="text-xs text-slate-400 mb-1 font-mono break-all">
              {syncConfig.workerUrl}
            </div>
            <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
              <span className="font-mono">
                {showKey ? syncConfig.syncKey : '•'.repeat(Math.min(syncConfig.syncKey.length, 32))}
              </span>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-sky-300 hover:text-sky-200 text-xs"
              >
                {showKey ? 'Skjul' : 'Vis'}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="text-sky-300 hover:text-sky-200 text-xs"
              >
                {copied ? 'Kopieret!' : 'Kopiér'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => void triggerPull()}
                disabled={syncState.kind === 'pulling' || syncState.kind === 'pushing'}
                className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Icon name="download" size={14} /> Hent nu
              </button>
              <button
                type="button"
                onClick={() => void triggerPush()}
                disabled={syncState.kind === 'pulling' || syncState.kind === 'pushing'}
                className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Icon name="upload" size={14} /> Send nu
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs"
              >
                Redigér
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 text-xs"
              >
                Slå fra
              </button>
            </div>
          </>
        ) : null}

        {editing ? (
          <div className="flex flex-col gap-3 mt-1">
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">
                Worker-URL
              </span>
              <input
                type="url"
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="https://ugeplan-sync.dit-brugernavn.workers.dev"
                className="w-full bg-slate-800 border border-slate-700 focus:border-sky-500 outline-none rounded-md px-2.5 py-2 text-sm font-mono"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1 flex items-center justify-between">
                <span>Sync-nøgle</span>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-sky-300 hover:text-sky-200 text-[11px] normal-case"
                >
                  Generér ny
                </button>
              </span>
              <input
                type={showKey ? 'text' : 'password'}
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value)}
                placeholder="32 tilfældige tegn"
                className="w-full bg-slate-800 border border-slate-700 focus:border-sky-500 outline-none rounded-md px-2.5 py-2 text-sm font-mono"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-sky-300 hover:text-sky-200 text-[11px] mt-1"
              >
                {showKey ? 'Skjul nøgle' : 'Vis nøgle'}
              </button>
            </label>

            {formError ? (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1.5">
                {formError}
              </div>
            ) : null}

            <div className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Tip:</strong> På den første enhed: indtast URL og klik "Generér ny" for
              at lave en nøgle. På andre enheder: indtast samme URL og indsæt samme nøgle.
              Begge er hemmelige — del dem ikke offentligt.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={probing}
                className="px-3 py-2 rounded-md bg-sky-500 text-white text-sm hover:bg-sky-400 disabled:opacity-60"
              >
                {probing ? 'Tester forbindelse…' : 'Gem og forbind'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={probing}
                className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-sm"
              >
                Annullér
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

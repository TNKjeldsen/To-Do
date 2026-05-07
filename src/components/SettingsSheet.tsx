import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { useAppState, useDispatch } from '../state/AppStateContext';
import {
  downloadBackup,
  exportToJSON,
  parseBackupString,
  readFileAsText,
  type ParsedBackup,
} from '../lib/backup';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

type ImportPreview =
  | { state: 'idle' }
  | { state: 'preview'; parsed: ParsedBackup; filename: string }
  | { state: 'error'; message: string }
  | { state: 'success'; count: number };

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview>({ state: 'idle' });

  const taskCount = state.tasks.length;
  const subtaskCount = state.tasks.reduce((acc, t) => acc + t.subtasks.length, 0);

  const handleExport = () => {
    downloadBackup(state);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await readFileAsText(file);
      const result = parseBackupString(text);
      if (!result.ok) {
        setImportPreview({ state: 'error', message: result.error });
        return;
      }
      setImportPreview({ state: 'preview', parsed: result, filename: file.name });
    } catch (err) {
      setImportPreview({
        state: 'error',
        message: err instanceof Error ? err.message : 'Ukendt fejl',
      });
    }
  };

  const confirmImport = () => {
    if (importPreview.state !== 'preview') return;
    // Auto-backup current data first to prevent accidental loss.
    if (state.tasks.length > 0) {
      try {
        const json = exportToJSON(state);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ugeplan-auto-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        // Best-effort; do not block import.
      }
    }
    dispatch({ type: 'IMPORT_REPLACE', data: importPreview.parsed.data });
    setImportPreview({ state: 'success', count: importPreview.parsed.taskCount });
  };

  const cancelImport = () => setImportPreview({ state: 'idle' });

  const handleClearAll = () => {
    if (
      window.confirm(
        `Slet ALLE ${taskCount} opgaver og deres underpunkter? Dette kan ikke fortrydes. Eksport\u00e9r f\u00f8rst hvis du vil beholde en kopi.`
      )
    ) {
      dispatch({ type: 'CLEAR_ALL' });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Indstillinger" large>
      <div className="px-4 py-4 flex flex-col gap-5">
        <section>
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Status
          </h3>
          <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-3 text-sm">
            <div>
              <span className="text-slate-400">Opgaver: </span>
              <span className="font-semibold">{taskCount}</span>
            </div>
            <div>
              <span className="text-slate-400">Underpunkter: </span>
              <span className="font-semibold">{subtaskCount}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Data gemmes lokalt i denne browser (localStorage).
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Backup
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Eksportér en JSON-fil som du kan gemme i iCloud Drive, Google Drive eller
            sende til dig selv. Importér igen på en anden enhed eller browser.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={taskCount === 0}
              className={[
                'px-3 py-2 rounded-md text-sm flex items-center gap-2 transition',
                taskCount === 0
                  ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-500 text-white hover:bg-sky-400',
              ].join(' ')}
            >
              <Icon name="download" size={16} />
              Eksportér JSON
            </button>
            <button
              type="button"
              onClick={handlePickFile}
              className="px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-2"
            >
              <Icon name="upload" size={16} />
              Importér JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {importPreview.state === 'preview' ? (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-semibold text-amber-200 mb-1">
                Bekræft import
              </div>
              <div className="text-amber-100/90 text-xs mb-2">
                Filen <span className="font-mono">{importPreview.filename}</span>{' '}
                indeholder <strong>{importPreview.parsed.taskCount}</strong> opgaver
                {importPreview.parsed.exportedAt
                  ? ` (eksporteret ${format(new Date(importPreview.parsed.exportedAt), 'd. MMM yyyy HH:mm', { locale: da })})`
                  : ''}
                . Dette vil <strong>erstatte</strong> dine nuværende {taskCount} opgaver.
                Der laves en automatisk sikkerhedskopi før import.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmImport}
                  className="px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-semibold text-xs hover:bg-amber-400"
                >
                  Erstat alt og importér
                </button>
                <button
                  type="button"
                  onClick={cancelImport}
                  className="px-3 py-1.5 rounded-md bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
                >
                  Annullér
                </button>
              </div>
            </div>
          ) : null}

          {importPreview.state === 'error' ? (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <div className="font-semibold mb-1">Kunne ikke importere</div>
              <div className="text-xs">{importPreview.message}</div>
              <button
                type="button"
                onClick={cancelImport}
                className="mt-2 px-3 py-1 rounded-md bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
              >
                OK
              </button>
            </div>
          ) : null}

          {importPreview.state === 'success' ? (
            <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <div className="font-semibold mb-1">Import gennemført</div>
              <div className="text-xs">
                {importPreview.count} opgaver er importeret.
              </div>
              <button
                type="button"
                onClick={cancelImport}
                className="mt-2 px-3 py-1 rounded-md bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
              >
                OK
              </button>
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Farezone
          </h3>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={taskCount === 0}
            className={[
              'px-3 py-2 rounded-md text-sm flex items-center gap-2 transition',
              taskCount === 0
                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                : 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20',
            ].join(' ')}
          >
            <Icon name="trash" size={16} />
            Slet alle data
          </button>
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Om
          </h3>
          <div className="text-xs text-slate-400 leading-relaxed">
            Ugeplan er en local-first app — al data ligger på din enhed og forlader
            den kun når du selv eksporterer. Ingen konto, ingen tracking, ingen
            backend. Sync mellem enheder sker via JSON-eksport/import.
          </div>
        </section>
      </div>
    </Sheet>
  );
}

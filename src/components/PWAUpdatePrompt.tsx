import { useEffect, useState } from 'react';

/**
 * Listens for service worker updates and shows a non-blocking banner when a
 * new version is ready. The "offline ready" toast is intentionally suppressed
 * — silent first-load caching is the expected PWA behaviour and a notification
 * just adds noise.
 */
export function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('virtual:pwa-register');
        const update = mod.registerSW({
          immediate: true,
          onNeedRefresh() {
            if (!cancelled) setNeedRefresh(true);
          },
        });
        if (!cancelled) setUpdateSW(() => update);
      } catch {
        // PWA not registered (likely in dev without enable flag) — ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:max-w-sm z-50 safe-bottom">
      <div className="rounded-xl bg-slate-800 border border-slate-700 shadow-xl px-3 py-3 text-sm flex items-start gap-3">
        <div className="flex-1">
          <div className="font-semibold">Ny version tilgængelig</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Genindlæs for at få seneste version.
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => updateSW?.(true)}
            className="px-2.5 py-1.5 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400"
          >
            Opdater
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="px-2.5 py-1.5 rounded-md bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}

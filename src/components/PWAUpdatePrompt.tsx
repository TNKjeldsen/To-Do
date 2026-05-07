import { useEffect, useState } from 'react';

/**
 * Listens for service worker updates and shows a non-blocking banner when a new
 * version is ready. Uses dynamic import so the app still builds when the PWA
 * virtual module is unavailable (e.g. in tests).
 */
export function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
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
          onOfflineReady() {
            if (!cancelled) setOfflineReady(true);
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

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:max-w-sm z-50 safe-bottom">
      <div className="rounded-xl bg-slate-800 border border-slate-700 shadow-xl px-3 py-3 text-sm flex items-start gap-3">
        <div className="flex-1">
          {needRefresh ? (
            <>
              <div className="font-semibold">Ny version tilgængelig</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Genindlæs for at få seneste version.
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold">Klar offline</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Appen virker nu også uden internet.
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {needRefresh ? (
            <button
              type="button"
              onClick={() => updateSW?.(true)}
              className="px-2.5 py-1.5 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400"
            >
              Opdater
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setNeedRefresh(false);
              setOfflineReady(false);
            }}
            className="px-2.5 py-1.5 rounded-md bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}

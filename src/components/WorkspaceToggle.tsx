import { WORKSPACES, type WorkspaceId } from '../types';
import { useAppState, useDispatch } from '../state/AppStateContext';

interface WorkspaceToggleProps {
  className?: string;
}

export function WorkspaceToggle({ className = '' }: WorkspaceToggleProps) {
  const { state } = useAppState();
  const dispatch = useDispatch();
  const active = state.activeWorkspace;

  const select = (id: WorkspaceId) => {
    if (id !== active) dispatch({ type: 'SET_WORKSPACE', workspace: id });
  };

  return (
    <div
      role="group"
      aria-label="Skift mellem privat og arbejde"
      className={[
        'inline-flex items-center rounded-lg bg-slate-800/70 border border-slate-700 p-0.5',
        className,
      ].join(' ')}
    >
      {WORKSPACES.map((w) => {
        const isActive = w.id === active;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => select(w.id)}
            aria-pressed={isActive}
            className={[
              'px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition',
              isActive
                ? w.id === 'work'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-sky-500 text-white'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50',
            ].join(' ')}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}

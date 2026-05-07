import { useEffect, useRef, useState } from 'react';
import type { Subtask } from '../types';
import { useDispatch } from '../state/AppStateContext';
import { Icon } from './Icon';

interface SubtaskRowProps {
  taskId: string;
  subtask: Subtask;
}

function SubtaskRow({ taskId, subtask }: SubtaskRowProps) {
  const dispatch = useDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next) {
      setDraft(subtask.text);
      return;
    }
    if (next === subtask.text) return;
    dispatch({
      type: 'UPDATE_SUBTASK',
      taskId,
      subId: subtask.id,
      patch: { text: next },
    });
  };

  return (
    <li className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-slate-800/40">
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_SUBTASK', taskId, subId: subtask.id })}
        aria-label={subtask.done ? 'Marker som ikke færdig' : 'Marker som færdig'}
        className={[
          'shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition',
          subtask.done
            ? 'bg-sky-500 border-sky-500 text-white'
            : 'border-slate-500 hover:border-slate-300',
        ].join(' ')}
      >
        {subtask.done ? <Icon name="check" size={14} /> : null}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(subtask.text);
              setEditing(false);
            }
          }}
          className="flex-1 bg-slate-800 border border-sky-500/60 rounded-md px-2 py-1 text-sm outline-none"
          enterKeyHint="done"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(subtask.text);
            setEditing(true);
          }}
          className={[
            'flex-1 text-left text-sm break-words py-1',
            subtask.done ? 'line-through text-slate-500' : 'text-slate-100',
          ].join(' ')}
        >
          {subtask.text}
        </button>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: 'DELETE_SUBTASK', taskId, subId: subtask.id })}
        aria-label="Slet underpunkt"
        className="shrink-0 p-1 rounded-md text-slate-500 hover:text-red-300 hover:bg-slate-700 transition"
      >
        <Icon name="x" size={15} />
      </button>
    </li>
  );
}

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
}

export function SubtaskList({ taskId, subtasks }: SubtaskListProps) {
  const dispatch = useDispatch();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    dispatch({ type: 'ADD_SUBTASK', taskId, text: v });
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div>
      <ul className="flex flex-col">
        {subtasks.length === 0 ? (
          <li className="text-xs text-slate-500 italic px-1 py-2">
            Ingen underpunkter endnu
          </li>
        ) : (
          subtasks
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => <SubtaskRow key={s.id} taskId={taskId} subtask={s} />)
        )}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tilføj underpunkt…"
          className="flex-1 bg-slate-800/60 border border-slate-700 focus:border-sky-500 focus:bg-slate-800 outline-none rounded-md px-2.5 py-2 text-sm placeholder:text-slate-500"
          enterKeyHint="done"
          autoCapitalize="sentences"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Tilføj underpunkt"
          className={[
            'shrink-0 p-2 rounded-md border transition',
            value.trim()
              ? 'bg-sky-500 border-sky-500 text-white hover:bg-sky-400'
              : 'bg-slate-800/60 border-slate-700 text-slate-500',
          ].join(' ')}
        >
          <Icon name="plus" size={16} />
        </button>
      </form>
    </div>
  );
}

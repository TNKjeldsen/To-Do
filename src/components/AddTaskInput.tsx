import { useRef, useState } from 'react';
import { useDispatch } from '../state/AppStateContext';
import { Icon } from './Icon';

interface AddTaskInputProps {
  date: string;
  placeholder?: string;
}

export function AddTaskInput({ date, placeholder = 'Tilf\u00f8j opgave\u2026' }: AddTaskInputProps) {
  const dispatch = useDispatch();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    dispatch({ type: 'ADD_TASK', date, title: v });
    setValue('');
    inputRef.current?.focus();
  };

  const hasValue = value.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-1 px-1"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-slate-800/60 border border-slate-700 focus:border-sky-500 focus:bg-slate-800 outline-none rounded-md px-2.5 py-2 text-sm placeholder:text-slate-500"
        enterKeyHint="done"
        autoCapitalize="sentences"
        autoComplete="off"
        spellCheck
      />
      <button
        type="submit"
        aria-label="Tilf\u00f8j"
        disabled={!hasValue}
        className={[
          'shrink-0 p-2 rounded-md border transition',
          hasValue
            ? 'bg-sky-500 border-sky-500 text-white hover:bg-sky-400'
            : 'bg-slate-800/60 border-slate-700 text-slate-500',
        ].join(' ')}
      >
        <Icon name="plus" size={16} />
      </button>
    </form>
  );
}

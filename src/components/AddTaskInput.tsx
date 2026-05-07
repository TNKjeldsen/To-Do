import { useRef, useState } from 'react';
import { useDispatch } from '../state/AppStateContext';

interface AddTaskInputProps {
  date: string;
  placeholder?: string;
}

export function AddTaskInput({ date, placeholder = 'Tilføj opgave…' }: AddTaskInputProps) {
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="px-1"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800/60 border border-slate-700 focus:border-sky-500 focus:bg-slate-800 outline-none rounded-md px-2.5 py-2 text-sm placeholder:text-slate-500"
        enterKeyHint="done"
        autoCapitalize="sentences"
        autoComplete="off"
        spellCheck
      />
    </form>
  );
}

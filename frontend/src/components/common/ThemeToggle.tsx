import React from 'react';
import { useStore } from '../../store/useStore';

export default function ThemeToggle() {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark and light theme"
    >
      <span className={'theme-track' + (theme === 'dark' ? ' is-dark' : '')}>
        <span className="theme-knob">☀☾</span>
      </span>
    </button>
  );
}

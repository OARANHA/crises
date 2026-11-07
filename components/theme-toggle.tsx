'use client';

import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'vigiaelus:theme';

export function ThemeToggle() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
    } catch {
      document.documentElement.dataset.theme = 'light';
    }
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
  }

  return (
    <button type="button" onClick={toggle} className="vigia-icon-button"
      aria-label="Alternar tema claro ou escuro" title="Alternar tema claro ou escuro">
      <Moon className="vigia-light-icon size-[18px]" />
      <Sun className="vigia-dark-icon size-[18px]" />
    </button>
  );
}

'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useThemeMode, type ThemeMode } from '@/context/theme-provider';

const themeOptions: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

function iconForMode(mode: ThemeMode) {
  if (mode === 'light') return Sun;
  if (mode === 'dark') return Moon;
  return Monitor;
}

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();
  const ActiveIcon = iconForMode(mode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Theme mode">
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.mode}
            onClick={() => setMode(option.mode)}
            className={option.mode === mode ? 'bg-accent text-accent-foreground' : undefined}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

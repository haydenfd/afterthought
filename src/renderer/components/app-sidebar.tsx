import {
  CalendarDays,
  Feather,
  Home,
  NotebookPen,
  PanelLeftClose,
  Settings,
  UserRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { SupermemoryStatus } from '@/components/supermemory-status';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSupermemory } from '@/state/supermemory-context';

const navItems = [
  { label: 'Today', to: '/today', icon: Home },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Reflections', to: '/reflections', icon: Feather },
  { label: 'You', to: '/profile', icon: UserRound },
  { label: 'Settings', to: '/settings', icon: Settings },
] as const;

export function AppSidebar({ onCollapse }: { onCollapse: () => void }) {
  const { status } = useSupermemory();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/55 px-3 py-4">
      <div className="mb-8 flex items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
            <NotebookPen className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5">Afterthought</p>
            <p className="truncate text-xs text-muted-foreground">Private journal</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Hide sidebar"
          title="Hide sidebar"
          onClick={onCollapse}
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <nav className="space-y-1" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                isActive && 'bg-secondary text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 px-1">
        <SupermemoryStatus status={status} compact />
      </div>
    </aside>
  );
}

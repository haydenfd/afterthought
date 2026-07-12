import {
  CalendarDays,
  ChevronsLeft,
  Feather,
  Home,
  NotebookPen,
  Settings,
  UserRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Today', to: '/today', icon: Home },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Reflections', to: '/reflections', icon: Feather },
  { label: 'You', to: '/profile', icon: UserRound },
  { label: 'Settings', to: '/settings', icon: Settings },
] as const;

export function AppSidebar({ onCollapse }: { onCollapse: () => void }) {
  return (
    <aside className="animate-sidebar-in flex w-56 shrink-0 flex-col border-r border-border bg-card/55 px-3 py-4">
      <div className="mb-8 flex items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
            <NotebookPen className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-sm font-semibold leading-5">
              Afterthought
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Hide sidebar"
          title="Hide sidebar"
          onClick={onCollapse}
          className="transition-transform duration-150 ease-out-quart hover:scale-105 active:scale-95"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <nav className="space-y-1" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'group relative flex h-9 items-center gap-2 overflow-hidden rounded-md px-2.5 text-sm text-muted-foreground transition-all duration-150 ease-out-quart hover:translate-x-0.5 hover:bg-secondary hover:text-foreground active:scale-[0.98]',
                isActive && 'translate-x-0 bg-secondary text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute inset-y-1 left-0 w-0.5 origin-top scale-y-0 rounded-full bg-primary transition-transform duration-200 ease-out-quart',
                    isActive && 'scale-y-100',
                  )}
                  aria-hidden="true"
                />
                <item.icon
                  className="h-4 w-4 transition-transform duration-150 ease-out-quart group-hover:scale-110"
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

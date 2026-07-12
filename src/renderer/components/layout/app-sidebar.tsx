import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Feather,
  NotebookPen,
  Plus,
  Settings,
  UserRound,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Reflections', to: '/reflections', icon: Feather },
  { label: 'You', to: '/profile', icon: UserRound },
  { label: 'Settings', to: '/settings', icon: Settings },
] as const;

export function AppSidebar({
  isOpen,
  onCollapse,
  onExpand,
}: {
  isOpen: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-border bg-card/55 py-4 transition-[width] duration-200 ease-out-quart',
        isOpen ? 'w-56 px-3' : 'w-12 px-1.5',
      )}
    >
      <div
        className={cn(
          'mb-8 flex items-center gap-2',
          isOpen ? 'justify-between px-2' : 'justify-center px-0',
        )}
      >
        {isOpen && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-sans text-sm font-semibold leading-5">
                Afterthought
              </p>
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isOpen ? 'Hide sidebar' : 'Show sidebar'}
          title={isOpen ? 'Hide sidebar' : 'Show sidebar'}
          onClick={isOpen ? onCollapse : onExpand}
          className="shrink-0 transition-transform duration-150 ease-out-quart hover:scale-105 active:scale-95"
        >
          {isOpen ? (
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {isOpen && (
        <>
          <Button
            asChild
            className="mb-5 w-full justify-start gap-2.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/entry/new" aria-label="New Entry" title="New Entry">
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">New Entry</span>
            </Link>
          </Button>

          <nav className="space-y-1" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-9 items-center gap-2 overflow-hidden rounded-md px-2.5 text-sm text-muted-foreground outline-none transition-all duration-150 ease-out-quart hover:translate-x-0.5 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]',
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
                      className="h-4 w-4 shrink-0 transition-transform duration-150 ease-out-quart group-hover:scale-110"
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}

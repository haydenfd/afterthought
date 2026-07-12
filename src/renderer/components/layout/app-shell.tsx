import { ChevronsRight } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {isSidebarOpen ? (
        <AppSidebar onCollapse={() => setIsSidebarOpen(false)} />
      ) : (
        <aside className="animate-rail-in flex w-12 shrink-0 border-r border-border bg-card/55 px-1.5 py-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Show sidebar"
            title="Show sidebar"
            onClick={() => setIsSidebarOpen(true)}
            className="transition-transform duration-150 ease-out-quart hover:scale-105 active:scale-95"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </aside>
      )}
      <main className="min-w-0 flex-1 overflow-y-auto duration-200 animate-in fade-in">
        <Outlet />
      </main>
    </div>
  );
}

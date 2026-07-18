import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { AppSidebar } from '@/components/layout/app-sidebar';

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar
        isOpen={isSidebarOpen}
        onCollapse={() => setIsSidebarOpen(false)}
        onExpand={() => setIsSidebarOpen(true)}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto duration-200 ease-out-quart animate-in fade-in motion-reduce:animate-none">
        <Outlet />
      </main>
    </div>
  );
}

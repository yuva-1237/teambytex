import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center gap-3 border-b bg-card px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <ThemeToggle />
            {role && (
              <Badge variant="secondary" className="capitalize text-xs">
                {role}
              </Badge>
            )}
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main
        className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ${
          collapsed ? "md:ml-[72px]" : "md:ml-[240px]"
        }`}
      >
        {/* Mobile header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 z-20 bg-background md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-display text-lg font-bold">
            Mov<span className="text-primary">way</span>
          </span>
        </div>

        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

"use client";

import Sidebar from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { EmojiProvider } from "@/components/EmojiContext";
import { GuildAvailabilityGuard } from "@/components/GuildAvailabilityGuard";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { DirtyStateProvider } from "@/components/DirtyStateProvider";
import { FloatingSaveBar } from "@/components/FloatingSaveBar";

interface GuildLayoutProps {
  children: React.ReactNode;
}

export default function GuildLayout({ children }: GuildLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll + auto-close sidebar when viewport reaches lg
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <DirtyStateProvider>
      <div className="fixed left-0 top-0 z-10 flex h-dvh w-screen grow overflow-hidden bg-dark-800 transition-all [padding-left:var(--dashboard-sidebar-gutter)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="relative flex max-w-screen max-w-full grow flex-col overflow-hidden bg-dark-700 lg:max-w-[calc(100vw-var(--dashboard-sidebar-width)-var(--dashboard-sidebar-gutter))]">
          <DashboardTopbar
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            showSidebarToggle
            showBrandOnDesktop={false}
            className="bg-dark-800"
          />

          <main className="relative flex flex-1 overflow-y-auto bg-dark-700 px-6 pt-4 lg:px-10 lg:pt-10">
            <div className="min-h-full w-full max-w-[1540px]">
              <EmojiProvider>
                <GuildAvailabilityGuard>{children}</GuildAvailabilityGuard>
              </EmojiProvider>
              {/* Odstęp na dole — na wszystkich szerokościach. NIE da się tego zrobić paddingiem:
                  <main> jest flex-kontenerem, więc wrapper przez align-items:stretch ma wysokość
                  widocznego obszaru, a nie swojej treści — treść wylewa się poza jego box, a
                  padding-bottom (tego wrappera albo <main>) ląduje w połowie pierwszego ekranu
                  zamiast pod ostatnim elementem (potwierdzone: scrollHeight nie rósł). Dlatego
                  <main> ma na desktopie tylko lg:pt-10, a dolne 40px daje ten element w przepływie. */}
              <div aria-hidden className="h-16 lg:h-10" />
            </div>
          </main>
        </div>
        <FloatingSaveBar />
      </div>
    </DirtyStateProvider>
  );
}

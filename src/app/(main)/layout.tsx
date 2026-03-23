import type { ReactNode } from "react";
import Link from "next/link";

type MainLayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-black/10 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/45">Reader App</p>
            <h1 className="font-serif text-xl text-black/90">Unified personal reading system</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm text-black/70">
            <Link className="rounded-full border border-black/10 px-3 py-1.5 hover:bg-black/5" href="/library">
              Library
            </Link>
            <Link className="rounded-full border border-black/10 px-3 py-1.5 hover:bg-black/5" href="/sources">
              Sources
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

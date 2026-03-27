import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/auth";
import { MainNav } from "@/components/layout/main-nav";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/server/auth/session";

type MainLayoutProps = {
  children: ReactNode;
};

export default async function MainLayout({ children }: MainLayoutProps) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-[rgba(248,245,238,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-8">
            <Link className="min-w-0" href="/library">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[color:var(--text-tertiary)]">
                Reader
              </p>
              <p className="mt-1 text-[15px] text-[color:var(--text-primary)]">Reading-first input hub</p>
            </Link>

            <MainNav />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-sm text-[color:var(--text-secondary)]">
            <span className="hidden rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3.5 py-2 sm:inline-flex">
              {user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button size="sm" type="submit" variant="quiet">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[78rem] px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}

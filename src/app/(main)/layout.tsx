import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/auth";
import { MainNav } from "@/components/layout/main-nav";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/server/auth/session";

type MainLayoutProps = {
  children: ReactNode;
};

export default async function MainLayout({ children }: MainLayoutProps) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-header)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-4 px-5 py-4 sm:px-6 lg:grid lg:grid-cols-[auto_minmax(15rem,24rem)_auto] lg:items-center lg:gap-x-6 lg:px-8">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
            <Link className="min-w-0 shrink-0" href="/sources">
              <p className="font-ui-heading text-[1.7rem] leading-none tracking-[-0.05em] text-[color:var(--text-primary-strong)]">
                Reader
              </p>
            </Link>

            <div className="min-w-0">
              <MainNav />
            </div>
          </div>

          <GlobalSearch />

          <div className="flex flex-wrap items-center gap-2.5 text-sm text-[color:var(--text-secondary)]">
            <ThemeToggle />
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
                退出登录
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[78rem] px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}

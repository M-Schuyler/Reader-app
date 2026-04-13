import type { ReactNode } from "react";
import Link from "next/link";
import { HeaderAccountMenu } from "@/components/layout/header-account-menu";
import { MainHeaderShell } from "@/components/layout/main-header-shell";
import { MainNav } from "@/components/layout/main-nav";
import { GlobalSearch } from "@/components/search/global-search";
import { requirePageUser } from "@/server/auth/session";

type MainLayoutProps = {
  children: ReactNode;
};

export default async function MainLayout({ children }: MainLayoutProps) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen">
      <MainHeaderShell>
        <div className="mx-auto flex max-w-[78rem] flex-col gap-3 px-5 py-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-6">
            <Link className="min-w-0 shrink-0" href="/sources">
              <p className="font-ui-heading text-[1.95rem] leading-none tracking-[-0.06em] text-[color:var(--text-primary-strong)]">
                Reader
              </p>
            </Link>

            <div className="w-full lg:mx-auto lg:max-w-[22.5rem]">
              <GlobalSearch open={false} onOpenChange={() => {}} />
            </div>

            <div className="flex items-center gap-2">
              <div className="empty:hidden" id="reader-panel-toggle-slot" />
              <HeaderAccountMenu email={user.email ?? null} />
            </div>
          </div>

          <div className="border-t border-[color:var(--border-subtle)] pt-3">
            <MainNav />
          </div>
        </div>
      </MainHeaderShell>
      <main className="mx-auto max-w-[78rem] px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}

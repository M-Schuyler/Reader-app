"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeaderAccountMenu } from "@/components/layout/header-account-menu";
import { MainHeaderShell } from "@/components/layout/main-header-shell";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NavigationRail } from "@/components/layout/navigation-rail";
import { GlobalSearch } from "@/components/search/global-search";
import { getPrimaryNavItems } from "@/lib/product-shell";
import { cx } from "@/utils/cx";

type MainWorkspaceChromeProps = {
  children: ReactNode;
  email: string | null;
};

export function MainWorkspaceChrome({ children, email }: MainWorkspaceChromeProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const items = getPrimaryNavItems({ pathname, searchOpen });
  const isDocumentPage = pathname.startsWith("/documents/");

  return (
    <div className="min-h-screen pb-[5.5rem] md:pb-0">
      <div className="md:grid md:grid-cols-[88px_minmax(0,1fr)]">
        <NavigationRail email={email} items={items} onSearchOpen={() => setSearchOpen(true)} searchOpen={searchOpen} />

        <div className="min-w-0">
          <MainHeaderShell className={isDocumentPage ? undefined : "md:hidden"}>
            <div
              className={cx(
                "mx-auto flex max-w-[78rem] items-center justify-between px-5 py-3 sm:px-6 lg:px-8",
                isDocumentPage ? "md:justify-end" : undefined,
              )}
            >
              <Link className="font-ui-heading text-[1.7rem] leading-none tracking-[-0.06em] md:hidden" href="/sources">
                Reader
              </Link>
              <div className="empty:hidden" id="reader-panel-toggle-slot" />
              <div className="md:hidden">
                <HeaderAccountMenu email={email} />
              </div>
            </div>
          </MainHeaderShell>

          <main className="mx-auto max-w-[78rem] px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
        </div>
      </div>

      <MobileBottomNav items={items} onSearchOpen={() => setSearchOpen(true)} />
      <GlobalSearch onOpenChange={setSearchOpen} open={searchOpen} />
    </div>
  );
}

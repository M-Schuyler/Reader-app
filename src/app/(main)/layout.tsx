import type { ReactNode } from "react";
import { MainWorkspaceChrome } from "@/components/layout/main-workspace-chrome";
import { requirePageUser } from "@/server/auth/session";

type MainLayoutProps = {
  children: ReactNode;
};

export default async function MainLayout({ children }: MainLayoutProps) {
  const user = await requirePageUser();

  return <MainWorkspaceChrome email={user.email ?? null}>{children}</MainWorkspaceChrome>;
}

import { signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

type HeaderAccountMenuProps = {
  email: string | null;
};

export function HeaderAccountMenu({ email }: HeaderAccountMenuProps) {
  const avatarLabel = resolveAvatarLabel(email);

  return (
    <details className="group relative [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-1.5 text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-surface)]">
        <span className="sr-only">打开账户菜单</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bg-surface-strong)] text-sm font-semibold">
          {avatarLabel}
        </span>
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.7rem)] z-40 w-[18rem] rounded-[26px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] p-4 shadow-[var(--shadow-surface)]">
        <div className="space-y-1 border-b border-[color:var(--border-subtle)] pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Profile</p>
          <p className="text-sm font-medium text-[color:var(--text-primary)] [overflow-wrap:anywhere]">
            {email ?? "当前账户"}
          </p>
        </div>

        <div className="space-y-3 py-4">
          <p className="text-xs font-medium text-[color:var(--text-secondary)]">主题</p>
          <ThemeToggle className="w-full justify-between" />
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="border-t border-[color:var(--border-subtle)] pt-4"
        >
          <Button className="w-full" size="sm" type="submit" variant="quiet">
            退出登录
          </Button>
        </form>
      </div>
    </details>
  );
}

function resolveAvatarLabel(email: string | null) {
  if (!email) {
    return "R";
  }

  const normalized = email.trim().charAt(0).toUpperCase();
  return normalized || "R";
}

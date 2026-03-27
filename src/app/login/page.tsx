import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getAuthenticatedUserFromSession, hasAllowedEmailsConfigured, sanitizeCallbackUrl } from "@/server/auth/access";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(getFirstValue(resolvedSearchParams?.callbackUrl));
  const error = getFirstValue(resolvedSearchParams?.error);
  const user = getAuthenticatedUserFromSession(await auth());
  const whitelistConfigured = hasAllowedEmailsConfigured();

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Panel className="w-full max-w-md p-8 sm:p-9" tone="default">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[color:var(--text-tertiary)]">Reader</p>
          <h1 className="font-ui-heading text-[2.3rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
            登录你的私人阅读空间
          </h1>
          <div className="space-y-2">
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
              这里承载你的采集、阅读与导出流程，只对明确授权的邮箱开放。
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
              Private access via GitHub
            </p>
          </div>
        </div>

        {!whitelistConfigured ? (
          <div className="mt-6 rounded-[20px] border border-[color:var(--badge-warning-bg)] bg-[color:var(--badge-warning-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--badge-warning-text)]">
            请先配置 <code>ALLOWED_EMAILS</code>。在白名单设置完成之前，所有登录都会被拒绝。
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-[20px] border border-[color:var(--badge-danger-bg)] bg-[color:var(--badge-danger-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--badge-danger-text)]">
            {formatErrorMessage(error)}
          </div>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: callbackUrl });
          }}
          className="mt-8"
        >
          <Button className="w-full" disabled={!whitelistConfigured} type="submit" variant="primary">
            使用 GitHub 登录
          </Button>
        </form>
      </Panel>
    </main>
  );
}

function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }

  return typeof value === "string" ? value : null;
}

function formatErrorMessage(error: string) {
  switch (error) {
    case "AccessDenied":
      return "GitHub 登录成功，但当前邮箱不在 Reader 白名单中。";
    case "Configuration":
      return "认证配置还不完整，请检查 Auth.js 相关环境变量。";
    default:
      return "登录失败，请稍后再试。";
  }
}

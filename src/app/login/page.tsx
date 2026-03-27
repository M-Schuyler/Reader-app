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
          <h1 className="font-display text-[2.3rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
            Sign in to your private reading hub
          </h1>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            GitHub sign-in protects the personal intake, reading, and export flow. Access is limited to explicitly
            whitelisted email addresses.
          </p>
        </div>

        {!whitelistConfigured ? (
          <div className="mt-6 rounded-[20px] border border-[color:var(--badge-warning-bg)] bg-[color:var(--badge-warning-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--badge-warning-text)]">
            Set <code>ALLOWED_EMAILS</code> before attempting to sign in. Until that whitelist is configured, all
            logins will be denied.
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
            Continue with GitHub
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
      return "This GitHub account signed in successfully, but its email address is not on the Reader allowlist.";
    case "Configuration":
      return "Authentication is not configured correctly yet. Check the Auth.js environment variables.";
    default:
      return "Sign in failed. Please try again.";
  }
}

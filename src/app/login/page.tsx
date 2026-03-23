import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
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
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_35%),linear-gradient(180deg,_#f8f7f2_0%,_#f1efe8_100%)] px-6 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white/85 p-8 shadow-xl shadow-black/5 backdrop-blur">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-black/45">Reader</p>
          <h1 className="font-serif text-3xl leading-tight text-black/92">Sign in to your private reading archive</h1>
          <p className="text-sm leading-6 text-black/62">
            GitHub login is required. Access is limited to explicitly whitelisted email addresses.
          </p>
        </div>

        {!whitelistConfigured ? (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Set <code>ALLOWED_EMAILS</code> before attempting to sign in. Until that whitelist is configured, all
            logins will be denied.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
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
          <button
            className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!whitelistConfigured}
            type="submit"
          >
            Continue with GitHub
          </button>
        </form>
      </section>
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

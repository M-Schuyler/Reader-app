import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DocumentPage({ params, searchParams }: DocumentPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const nextSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          nextSearchParams.append(key, item);
        }
      }
      continue;
    }

    if (typeof value === "string") {
      nextSearchParams.set(key, value);
    }
  }

  const query = nextSearchParams.toString();
  redirect(query ? `/reading/${resolvedParams.id}?${query}` : `/reading/${resolvedParams.id}`);
}

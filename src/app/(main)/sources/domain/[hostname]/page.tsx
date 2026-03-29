import { SourceDetailPage } from "../../source-detail-page";

export const dynamic = "force-dynamic";

type SourceDomainDetailPageProps = {
  params: Promise<{ hostname: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourceDomainDetailPage({ params, searchParams }: SourceDomainDetailPageProps) {
  const resolvedParams = await params;
  const hostname = decodeURIComponent(resolvedParams.hostname);

  return (
    <SourceDetailPage
      basePath={`/sources/domain/${encodeURIComponent(hostname)}`}
      searchParams={searchParams}
      source={{ kind: "domain", value: hostname }}
    />
  );
}

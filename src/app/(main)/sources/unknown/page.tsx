import { SourceDetailPage } from "../source-detail-page";

export const dynamic = "force-dynamic";

type SourceUnknownDetailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourceUnknownDetailPage({ searchParams }: SourceUnknownDetailPageProps) {
  return <SourceDetailPage basePath="/sources/unknown" searchParams={searchParams} source={{ kind: "unknown", value: null }} />;
}

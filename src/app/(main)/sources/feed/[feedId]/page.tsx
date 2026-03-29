import { SourceDetailPage } from "../../source-detail-page";

export const dynamic = "force-dynamic";

type SourceFeedDetailPageProps = {
  params: Promise<{ feedId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourceFeedDetailPage({ params, searchParams }: SourceFeedDetailPageProps) {
  const resolvedParams = await params;
  const feedId = decodeURIComponent(resolvedParams.feedId);

  return (
    <SourceDetailPage
      basePath={`/sources/feed/${encodeURIComponent(feedId)}`}
      searchParams={searchParams}
      source={{ kind: "feed", value: feedId }}
    />
  );
}

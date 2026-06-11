import { IngestionStatus } from "@prisma/client";
import { WechatArchiveCatalog } from "@/components/library/wechat-archive-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { parseSourceLibraryQuery, resolveSourceSearchParams } from "@/lib/documents/source-library-query";
import { getDocuments } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type WechatArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WechatArchivePage({ searchParams }: WechatArchivePageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const data = await getDocuments({
    ...parsedQuery,
    ingestionStatus: IngestionStatus.CATALOG,
    pageSize: 50,
    surface: "source",
  });
  const previousHref = data.pagination.page > 1 ? buildArchivePageHref(data.pagination.page - 1) : null;
  const nextHref = data.pagination.page < data.pagination.totalPages ? buildArchivePageHref(data.pagination.page + 1) : null;

  return (
    <section className="space-y-8">
      <PageHeader eyebrow="备份库" title="公众号存档" />

      <Panel className="space-y-2" tone="muted">
        <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
          这里先保存轻量目录，不读取正文，也不会预先调用 AI。选择文章并导入后，Reader 才会读取本地 Markdown、进入阅读流并生成摘要。
        </p>
        <p className="text-xs text-[color:var(--text-tertiary)]">当前还有 {data.pagination.total} 篇存档未导入。</p>
      </Panel>

      <WechatArchiveCatalog
        data={data}
        emptyState={{
          eyebrow: "备份库",
          title: "还没扫描存档",
          description: "运行一次公众号存档目录导入脚本，这里就会出现可按需导入的文章。",
        }}
        nextHref={nextHref}
        previousHref={previousHref}
      />
    </section>
  );
}

function buildArchivePageHref(page: number) {
  return page > 1 ? `/sources/archive?page=${page}` : "/sources/archive";
}

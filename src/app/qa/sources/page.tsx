import { notFound } from "next/navigation";
import { SourceLibrary } from "@/components/library/source-library";
import { Panel } from "@/components/ui/panel";
import { PageHeader } from "@/components/ui/page-header";
import { getSourceLibraryQaFixture } from "@/lib/documents/source-library-qa-fixture";

export default function QaSourcesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        className="gap-6"
        description="这页只用来检查来源库的真实组件结构。长标题、短标题、同来源分组和失败态都放进来了。"
        eyebrow="QA Preview"
        title="来源库预览"
      />

      <Panel
        className="rounded-[28px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4"
        tone="muted"
      >
        <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
          这里不是线上真实数据，也不是另一套 demo 组件。
          它直接复用当前的来源库展示组件，只是把固定 fixture 喂进去，方便我们盯布局问题。
        </p>
      </Panel>

      <SourceLibrary data={getSourceLibraryQaFixture()} />
    </section>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

type SourceLibraryDetailFiltersProps = {
  clearHref: string;
  contentOrigin?: GetDocumentsResponseData["contentOrigin"];
  filters: GetDocumentsResponseData["filters"];
  hasActiveFilters: boolean;
};

export function SourceLibraryDetailFilters({
  clearHref,
  contentOrigin,
  filters,
  hasActiveFilters,
}: SourceLibraryDetailFiltersProps) {
  const shouldShowContentOrigin = Boolean(contentOrigin?.options.length && contentOrigin.options.length > 1);

  return (
    <Panel className="rounded-[28px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4" tone="muted">
      <form className="space-y-4" method="GET">
        {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}
        {filters.tag ? <input name="tag" type="hidden" value={filters.tag} /> : null}

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">当前来源内筛选</p>
          <p className="text-sm text-[color:var(--text-secondary)]">这里只调整这个来源下的文档列表，不会影响一级来源库。</p>
        </div>

        <div
          className={
            shouldShowContentOrigin
              ? "grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
              : "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
          }
        >
          {shouldShowContentOrigin ? (
            <Field label="创作来源">
              <SelectInput className="min-h-10 rounded-[16px]" defaultValue={filters.origin ?? ""} name="origin">
                <option value="">全部来源</option>
                {contentOrigin?.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}

          <Field label="排序">
            <SelectInput className="min-h-10 rounded-[16px]" defaultValue={filters.sort} name="sort">
              <option value="latest">最新收进来</option>
              <option value="earliest">最早收进来</option>
            </SelectInput>
          </Field>

          <div className="flex items-center gap-2 md:justify-end">
            <Button className="flex-1 md:flex-none" size="sm" type="submit" variant="primary">
              应用筛选
            </Button>
            {hasActiveFilters ? (
              <Link
                className="inline-flex min-h-9 items-center justify-center rounded-[16px] px-3.5 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]"
                href={clearHref}
              >
                清空
              </Link>
            ) : null}
          </div>
        </div>
      </form>
    </Panel>
  );
}

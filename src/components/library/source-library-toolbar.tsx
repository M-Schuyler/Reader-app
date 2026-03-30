import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import { CaptureUrlForm } from "@/components/library/capture-url-form";
import { CreateSourceForm } from "@/components/library/create-source-form";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

type SourceLibraryToolbarProps = {
  filters: GetDocumentsResponseData["filters"];
  clearHref: string;
  hasActiveFilters: boolean;
};

export function SourceLibraryToolbar({
  clearHref,
  filters,
  hasActiveFilters,
}: SourceLibraryToolbarProps) {
  return (
    <Panel className="rounded-[30px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(19rem,0.95fr)]">
        <div className="rounded-[26px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 py-4 sm:px-5">
          <CaptureUrlForm variant="compact" />
        </div>

        <div className="rounded-[26px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 py-4 sm:px-5">
          <CreateSourceForm />
        </div>

        <form
          className="rounded-[26px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 py-4 sm:px-5"
          method="GET"
        >
          {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <Field label="文档类型">
                <SelectInput className="min-h-10 rounded-[16px]" defaultValue={filters.type ?? ""} name="type">
                  <option value="">全部类型</option>
                  <option value="WEB_PAGE">网页</option>
                  <option value="RSS_ITEM">RSS</option>
                  <option value="PDF">PDF</option>
                </SelectInput>
              </Field>

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
          </div>
        </form>
      </div>
    </Panel>
  );
}

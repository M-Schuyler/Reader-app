import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import { CaptureUrlForm } from "@/components/library/capture-url-form";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

type SourceLibraryToolbarProps = {
  filters: GetDocumentsResponseData["filters"];
  clearHref: string;
  hasActiveFilters: boolean;
};

const SHELF_GUIDE = ["最近收进来", "近七天", "更早"];

export function SourceLibraryToolbar({
  clearHref,
  filters,
  hasActiveFilters,
}: SourceLibraryToolbarProps) {
  return (
    <Panel className="space-y-5 rounded-[32px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
        <div className="rounded-[28px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-4 sm:px-5">
          <CaptureUrlForm variant="compact" />
        </div>

        <form
          className="rounded-[28px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-4 sm:px-5"
          method="GET"
        >
          {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                Browse
              </p>
              <h2 className="font-ui-heading text-[1.2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
                收得安静一点，找得快一点
              </h2>
            </div>

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

      <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border-subtle)] pt-4">
        <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
          Shelves
        </span>
        {SHELF_GUIDE.map((label) => (
          <span
            className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-sm text-[color:var(--text-secondary)]"
            key={label}
          >
            {label}
          </span>
        ))}
      </div>
    </Panel>
  );
}

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
    <form className="flex items-center gap-2" method="GET">
      {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}
      {filters.tag ? <input name="tag" type="hidden" value={filters.tag} /> : null}

      <div className="flex items-center gap-2">
        {shouldShowContentOrigin ? (
          <SelectInput 
            className="h-8 min-h-0 rounded-full bg-stone-900/5 px-3 text-[12px] font-medium border-0 focus:ring-1 focus:ring-[color:var(--ai-card-accent)]" 
            defaultValue={filters.origin ?? ""} 
            name="origin"
          >
            <option value="">全部创作来源</option>
            {contentOrigin?.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        ) : null}

        <SelectInput 
          className="h-8 min-h-0 rounded-full bg-stone-900/5 px-3 text-[12px] font-medium border-0 focus:ring-1 focus:ring-[color:var(--ai-card-accent)]" 
          defaultValue={filters.sort} 
          name="sort"
        >
          <option value="latest">最新</option>
          <option value="earliest">最早</option>
        </SelectInput>

        <Button className="h-8 min-h-0 rounded-full px-4 text-[12px] font-bold" type="submit" variant="primary">
          应用
        </Button>
        
        {hasActiveFilters && (
          <Link
            className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ai-card-accent)] hover:underline px-1"
            href={clearHref}
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}

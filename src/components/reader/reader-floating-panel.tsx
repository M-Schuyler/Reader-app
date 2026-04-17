"use client";

import Link from "next/link";
import { IngestionStatus } from "@prisma/client";
import { DocumentTagPills } from "@/components/documents/document-tag-pills";
import { FavoriteToggleButton, type useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { HighlightSaveModeToggle } from "@/components/reader/highlight-save-mode-toggle";
import { ReaderHighlightsPanel, type useDocumentHighlights } from "@/components/reader/reader-highlights";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { formatPublishedAtLabel, resolveDocumentDateMetaLabel } from "@/lib/documents/published-at";
import { useReaderPreferences } from "@/lib/highlights/preferences.store";
import {
  resolveReaderFontSizePreferenceValue,
  resolveReaderLineHeightPreferenceValue,
  type ReaderFontSizePreference,
  type ReaderLineHeightPreference,
} from "@/lib/highlights/preferences";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";
import type { TocItem } from "./use-reader-toc";
import { ReaderTableOfContents } from "./reader-toc";

export type ReaderFloatingPanelTab = "highlights" | "actions" | "meta" | "contents";

type ReaderFloatingPanelProps = {
  activeTab: ReaderFloatingPanelTab;
  activeHeaderId: string | null;
  canHighlight: boolean;
  document: DocumentDetail;
  documentHighlights: ReturnType<typeof useDocumentHighlights>;
  favorite: ReturnType<typeof useDocumentFavoriteController>;
  isReadable: boolean;
  onTabChange: (tab: ReaderFloatingPanelTab) => void;
  onHighlightSaveModeChange: () => void;
  sourceUrl: string | null;
  toc: TocItem[];
};

export function ReaderFloatingPanel({
  activeTab,
  activeHeaderId,
  canHighlight,
  document: readerDocument,
  documentHighlights,
  favorite,
  isReadable,
  onTabChange,
  onHighlightSaveModeChange,
  sourceUrl,
  toc,
}: ReaderFloatingPanelProps) {
  const highlightSaveMode = useReaderPreferences((state) => state.highlightSaveMode);
  const setHighlightSaveMode = useReaderPreferences((state) => state.setHighlightSaveMode);
  const documentAttribution = resolveDocumentAttribution(readerDocument);
  const markdownDownloadHref = `/api/documents/${readerDocument.id}/download?format=markdown`;
  const htmlDownloadHref = `/api/documents/${readerDocument.id}/download?format=html`;
  const obsidianDownloadHref = `/api/documents/${readerDocument.id}/download?format=obsidian`;

  function handleHighlightSaveModeChange(mode: typeof highlightSaveMode) {
    setHighlightSaveMode(mode);
    onHighlightSaveModeChange();
  }

  return (
    <Panel className="max-h-[calc(100vh-80px)] overflow-y-auto border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-surface)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] pb-3">
        {toc.length > 1 ? (
          <FloatingTabButton
            active={activeTab === "contents"}
            label="目录"
            onClick={() => onTabChange("contents")}
          />
        ) : null}
        {canHighlight ? (
          <FloatingTabButton
            active={activeTab === "highlights"}
            label="高亮"
            onClick={() => onTabChange("highlights")}
          />
        ) : null}
        <FloatingTabButton
          active={activeTab === "actions"}
          label="操作"
          onClick={() => onTabChange("actions")}
        />
        <FloatingTabButton
          active={activeTab === "meta"}
          label="信息"
          onClick={() => onTabChange("meta")}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "contents" ? (
          <ReaderTableOfContents activeId={activeHeaderId} toc={toc} />
        ) : null}

        {activeTab === "highlights" ? (
          canHighlight ? (
            <ReaderHighlightsPanel
              actionError={documentHighlights.actionError}
              focusedHighlightId={documentHighlights.focusedHighlightId}
              highlights={documentHighlights.highlights}
              isLoading={documentHighlights.isLoading}
              onDelete={documentHighlights.removeHighlightById}
              onFocusedHighlightHandled={documentHighlights.clearFocusedHighlight}
              onSaveNote={documentHighlights.saveHighlightNote}
              savingNoteId={documentHighlights.savingNoteId}
            />
          ) : (
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">当前文档暂无可编辑高亮。</p>
          )
        ) : null}

        {activeTab === "actions" ? (
          <div className="space-y-4">
            <FavoriteToggleButton
              buttonLabel={favorite.buttonLabel}
              className="w-full justify-center"
              isFavorite={favorite.isFavorite}
              isSubmitting={favorite.isSubmitting}
              onClick={favorite.toggleFavorite}
            />
            {canHighlight ? (
              <div className="space-y-4">
                <HighlightSaveModeToggle
                  onChange={handleHighlightSaveModeChange}
                  value={highlightSaveMode}
                />
                <ReaderTypographyControl />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <div className="space-y-2 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                  下载
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                    href={markdownDownloadHref}
                  >
                    下载 Markdown
                  </a>
                  <a
                    className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                    href={obsidianDownloadHref}
                  >
                    下载 Obsidian
                  </a>
                  <a
                    className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                    href={htmlDownloadHref}
                  >
                    下载 HTML
                  </a>
                </div>
              </div>
              {sourceUrl ? (
                <Link
                  className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                  href={sourceUrl}
                  target="_blank"
                >
                  打开原文
                </Link>
              ) : null}
              <Link
                className="inline-flex min-h-10 items-center rounded-[18px] border border-transparent px-1 text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                href="/reading"
              >
                返回 Reading
              </Link>
            </div>
            {favorite.actionError ? (
              <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{favorite.actionError}</p>
            ) : null}
          </div>
        ) : null}

        {activeTab === "meta" ? (
          <div className="space-y-4">
            <dl className="space-y-3 text-sm">
              <MetaRow label="状态" value={formatIngestionStatus(readerDocument.ingestionStatus)} />
              <MetaRow
                label={resolveDocumentDateMetaLabel(readerDocument.publishedAt, readerDocument.createdAt)}
                value={formatPublishedAtLabel(
                  readerDocument.publishedAt,
                  readerDocument.publishedAtKind,
                  readerDocument.createdAt,
                )}
              />
              {documentAttribution ? <MetaRow label={documentAttribution.label} value={documentAttribution.value} /> : null}
              {readerDocument.lang ? <MetaRow label="语言" value={readerDocument.lang} /> : null}
              {isReadable && readerDocument.content?.wordCount ? (
                <MetaRow label="字数" value={formatWordCount(readerDocument.content.wordCount)} />
              ) : null}
              {sourceUrl ? <MetaRow label="来源" value={truncateUrl(sourceUrl)} /> : null}
            </dl>

            {readerDocument.tags.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">标签</p>
                <DocumentTagPills basePath="/reading" tags={readerDocument.tags} />
              </div>
            ) : null}

            {favorite.isFavorite ? (
              <div className="rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                  收藏
                </p>
                <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                  这篇内容会保留在收藏视图里，方便你之后更快回到它。
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
      <dt className="text-[color:var(--text-tertiary)]">{label}</dt>
      <dd className="min-w-0 text-right text-[color:var(--text-primary)]">
        <span className="block truncate" title={value}>
          {value}
        </span>
      </dd>
    </div>
  );
}

function FloatingTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-selected={active}
      className={cx(
        "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold transition",
        active
          ? "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]"
          : "border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

const fontSizeOptions: Array<{ description: string; label: string; value: ReaderFontSizePreference }> = [
  {
    description: "更紧凑，适合信息密度更高的阅读。",
    label: "小",
    value: "small",
  },
  {
    description: "平衡阅读节奏与信息密度。",
    label: "中",
    value: "medium",
  },
  {
    description: "更大字号，长时间阅读更轻松。",
    label: "大",
    value: "large",
  },
];

const lineHeightOptions: Array<{ description: string; label: string; value: ReaderLineHeightPreference }> = [
  {
    description: "行距更紧，滚动更少。",
    label: "紧凑",
    value: "compact",
  },
  {
    description: "默认阅读行距。",
    label: "舒适",
    value: "comfortable",
  },
  {
    description: "更松弛，段落更透气。",
    label: "宽松",
    value: "loose",
  },
];

function ReaderTypographyControl() {
  const { readerFontSize: fontSize, readerLineHeight: lineHeight, setReaderFontSize, setReaderLineHeight } = useReaderPreferences();

  const activeFontSize = fontSizeOptions.find((option) => option.value === fontSize) ?? fontSizeOptions[1];
  const activeLineHeight = lineHeightOptions.find((option) => option.value === lineHeight) ?? lineHeightOptions[1];

  return (
    <div className="space-y-4 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">阅读排版</p>
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
          字号：{activeFontSize.label} · 行距：{activeLineHeight.label}
        </p>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">字体大小</p>
        <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-1">
          {fontSizeOptions.map((option) => (
            <button
              aria-pressed={fontSize === option.value}
              className={cx(
                "min-h-8 rounded-full px-3 text-xs font-semibold transition",
                fontSize === option.value
                  ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
              )}
              key={option.value}
              onClick={() => setReaderFontSize(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">行距</p>
        <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-1">
          {lineHeightOptions.map((option) => (
            <button
              aria-pressed={lineHeight === option.value}
              className={cx(
                "min-h-8 rounded-full px-3 text-xs font-semibold transition",
                lineHeight === option.value
                  ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
              )}
              key={option.value}
              onClick={() => setReaderLineHeight(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

function resolveDocumentAttribution(document: DocumentDetail) {
  if (document.contentOrigin?.label) {
    return {
      label: "公众号",
      value: document.contentOrigin.label,
    };
  }

  if (document.author) {
    return {
      label: "作者",
      value: document.author,
    };
  }

  return null;
}

function formatIngestionStatus(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED:
      return "抓取失败";
    case IngestionStatus.READY:
      return "可阅读";
    case IngestionStatus.PROCESSING:
      return "处理中";
    case IngestionStatus.PENDING:
    default:
      return "排队中";
  }
}

function formatWordCount(value: number) {
  return `${new Intl.NumberFormat("zh-CN").format(value)} 字`;
}

function truncateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value;
  }
}

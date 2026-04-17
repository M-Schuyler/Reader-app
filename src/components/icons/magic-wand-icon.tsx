import { cx } from "@/utils/cx";

type MagicWandIconProps = {
  className?: string;
};

/**
 * AI 智能图标：System Intelligence (非对称双星)
 * 采用 Apple Intelligence 风格语言，通过两颗重心偏移、一大一小的 4 角弧边星芒产生灵动感。
 * 表达系统级的理解、提炼与生成能力，去中心化，视觉感官清爽克制。
 */
export function MagicWandIcon({ className }: MagicWandIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {/* 主智能星 */}
      <path d="M12 3c0 4.5-2 6.5-6.5 6.5 4.5 0 6.5 2 6.5 6.5 0-4.5 2-6.5 6.5-6.5-4.5 0-6.5-2-6.5-6.5Z" />
      {/* 辅助智能星：产生动态偏移感 */}
      <path d="M5 16c0 2.5-1 3.5-3.5 3.5 2.5 0 3.5 1 3.5 3.5 0-2.5 1-3.5 3.5-3.5-2.5 0-3.5-1-3.5-3.5Z" />
    </svg>
  );
}

/**
 * 收藏：全圆角精修五角星
 */
export function PremiumStarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cx("h-4 w-4", className)}
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/**
 * 高亮：极简钢笔尖
 */
export function NibIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l5.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.5 7.5" />
      <path d="M11 11a2 2 0 114 0 2 2 0 01-4 0z" />
    </svg>
  );
}

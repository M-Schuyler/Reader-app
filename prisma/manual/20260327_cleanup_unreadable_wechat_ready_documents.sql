-- Run with:
-- psql "$DATABASE_URL" -f prisma/manual/20260327_cleanup_unreadable_wechat_ready_documents.sql

BEGIN;

CREATE TEMP TABLE cleanup_unreadable_wechat_documents AS
WITH candidates AS (
  SELECT
    d.id,
    d.title,
    d."sourceUrl",
    d."canonicalUrl",
    d.excerpt,
    d."ingestionStatus",
    c."wordCount",
    c."plainText",
    CASE
      WHEN COALESCE(d."canonicalUrl", '') LIKE '%/mp/wappoc_appmsgcaptcha%'
        OR COALESCE(d.excerpt, '') ~ '(当前环境异常|完成验证后即可继续访问|去验证|环境异常)'
        OR COALESCE(c."plainText", '') ~ '(当前环境异常|完成验证后即可继续访问|去验证|环境异常)'
      THEN 'verification'
      WHEN COALESCE(c."wordCount", 0) <= 30
        AND COALESCE(c."plainText", '') ~ '(微信扫一扫|使用小程序|向上滑动看下一个|使用完整服务)'
      THEN 'share_shell'
      ELSE NULL
    END AS cleanup_reason
  FROM "Document" d
  LEFT JOIN "DocumentContent" c
    ON c."documentId" = d.id
  WHERE d.type = 'WEB_PAGE'
    AND d."ingestionStatus" = 'READY'
    AND (
      COALESCE(d."sourceUrl", '') LIKE 'https://mp.weixin.qq.com/%'
      OR COALESCE(d."canonicalUrl", '') LIKE 'https://mp.weixin.qq.com/%'
    )
    AND c.id IS NOT NULL
)
SELECT
  id,
  "sourceUrl",
  cleanup_reason
FROM candidates
WHERE cleanup_reason IS NOT NULL;

SELECT
  cleanup_reason,
  count(*) AS matched_documents
FROM cleanup_unreadable_wechat_documents
GROUP BY cleanup_reason
ORDER BY cleanup_reason;

DELETE FROM "DocumentContent" c
USING cleanup_unreadable_wechat_documents b
WHERE c."documentId" = b.id;

UPDATE "Document" d
SET
  title = CASE
    WHEN d."sourceUrl" IS NOT NULL THEN regexp_replace(d."sourceUrl", '^https?://([^/]+).*$','\1')
    ELSE d.title
  END,
  lang = NULL,
  "canonicalUrl" = NULL,
  excerpt = NULL,
  author = NULL,
  "publishedAt" = NULL,
  "ingestionStatus" = 'FAILED',
  "updatedAt" = NOW()
FROM cleanup_unreadable_wechat_documents b
WHERE d.id = b.id;

UPDATE "IngestionJob" j
SET
  status = 'FAILED',
  "errorMessage" = CASE
    WHEN b.cleanup_reason = 'share_shell'
      THEN '来源站点返回了微信分享壳页面，无法提取可阅读正文。'
    ELSE '来源站点触发验证或环境异常，当前无法稳定抓取正文。'
  END,
  "payloadJson" = jsonb_build_object(
    'error',
    jsonb_build_object(
      'code',
      CASE
        WHEN b.cleanup_reason = 'share_shell' THEN 'EXTRACTION_UNREADABLE'
        ELSE 'SOURCE_VERIFICATION_REQUIRED'
      END,
      'message',
      CASE
        WHEN b.cleanup_reason = 'share_shell'
          THEN '来源站点返回了微信分享壳页面，无法提取可阅读正文。'
        ELSE '来源站点触发验证或环境异常，当前无法稳定抓取正文。'
      END
    )
  ),
  "finishedAt" = COALESCE(j."finishedAt", NOW()),
  "updatedAt" = NOW()
FROM cleanup_unreadable_wechat_documents b
WHERE j.kind = 'FETCH_WEB_PAGE'
  AND (
    j."documentId" = b.id
    OR (
      b."sourceUrl" IS NOT NULL
      AND j."sourceUrl" = b."sourceUrl"
    )
  );

SELECT
  count(*) FILTER (WHERE d."ingestionStatus" = 'FAILED') AS failed_documents,
  count(c.id) AS remaining_content_rows
FROM cleanup_unreadable_wechat_documents b
JOIN "Document" d
  ON d.id = b.id
LEFT JOIN "DocumentContent" c
  ON c."documentId" = d.id;

COMMIT;

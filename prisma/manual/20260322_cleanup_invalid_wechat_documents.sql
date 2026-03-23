-- Run with:
-- psql "$DATABASE_URL" -f prisma/manual/20260322_cleanup_invalid_wechat_documents.sql

BEGIN;

CREATE TEMP TABLE cleanup_bad_wechat_documents AS
SELECT DISTINCT
  d.id,
  d."sourceUrl"
FROM "Document" d
LEFT JOIN "DocumentContent" c
  ON c."documentId" = d.id
WHERE d.type = 'WEB_PAGE'
  AND (
    COALESCE(d."sourceUrl", '') LIKE '%mp.weixin.qq.com%'
    OR COALESCE(d."canonicalUrl", '') LIKE '%mp.weixin.qq.com%'
  )
  AND (
    COALESCE(d."canonicalUrl", '') LIKE '%/mp/wappoc_appmsgcaptcha%'
    OR COALESCE(d.excerpt, '') ~ '(当前环境异常|完成验证后即可继续访问|去验证|环境异常)'
    OR COALESCE(c."plainText", '') ~ '(当前环境异常|完成验证后即可继续访问|去验证|环境异常)'
  );

SELECT count(*) AS matched_documents
FROM cleanup_bad_wechat_documents;

DELETE FROM "DocumentContent" c
USING cleanup_bad_wechat_documents b
WHERE c."documentId" = b.id;

UPDATE "Document" d
SET
  title = CASE
    WHEN d."sourceUrl" IS NOT NULL THEN regexp_replace(d."sourceUrl", '^https?://([^/]+).*$','\1')
    ELSE d.title
  END,
  "canonicalUrl" = NULL,
  excerpt = NULL,
  "ingestionStatus" = 'FAILED',
  "updatedAt" = NOW()
FROM cleanup_bad_wechat_documents b
WHERE d.id = b.id;

UPDATE "IngestionJob" j
SET
  status = 'FAILED',
  "errorMessage" = '来源站点触发验证或环境异常，当前无法稳定抓取正文。',
  "payloadJson" = jsonb_build_object(
    'error',
    jsonb_build_object(
      'code', 'SOURCE_VERIFICATION_REQUIRED',
      'message', '来源站点触发验证或环境异常，当前无法稳定抓取正文。'
    )
  ),
  "finishedAt" = COALESCE(j."finishedAt", NOW()),
  "updatedAt" = NOW()
FROM cleanup_bad_wechat_documents b
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
FROM cleanup_bad_wechat_documents b
JOIN "Document" d
  ON d.id = b.id
LEFT JOIN "DocumentContent" c
  ON c."documentId" = d.id;

COMMIT;

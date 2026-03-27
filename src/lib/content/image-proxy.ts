const IMAGE_PROXY_ROUTE = "/api/assets/image";
const PROXYABLE_IMAGE_HOSTS = new Set(["mmbiz.qpic.cn"]);

export function buildImageProxyUrl(imageUrl: string) {
  return `${IMAGE_PROXY_ROUTE}?url=${encodeURIComponent(imageUrl)}`;
}

export function parseImageProxyTarget(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    if (!PROXYABLE_IMAGE_HOSTS.has(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveReaderImageUrl(value: string | null, sourceUrl: string | null) {
  const resolvedUrl = resolveHttpUrl(value, sourceUrl);
  if (!resolvedUrl) {
    return null;
  }

  return parseImageProxyTarget(resolvedUrl) ? buildImageProxyUrl(resolvedUrl) : resolvedUrl;
}

function resolveHttpUrl(value: string | null, sourceUrl: string | null) {
  if (!value) {
    return null;
  }

  try {
    const resolved = sourceUrl ? new URL(value, sourceUrl) : new URL(value);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

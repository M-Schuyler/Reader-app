import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, RouteError } from "@/server/api/response";
import { parseImageProxyTarget } from "@/lib/content/image-proxy";

const CACHE_CONTROL_HEADER = "private, max-age=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  try {
    const target = parseImageProxyTarget(request.nextUrl.searchParams.get("url"));
    if (!target) {
      throw new RouteError("UNSUPPORTED_IMAGE_URL", 400, "The image URL is invalid or not supported.");
    }

    const upstream = await fetch(target, {
      method: "GET",
      redirect: "follow",
      cache: "force-cache",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!upstream.ok) {
      throw new RouteError("IMAGE_FETCH_FAILED", 502, "Failed to fetch the proxied image.");
    }

    const contentType = upstream.headers.get("content-type");
    if (!contentType?.startsWith("image/")) {
      throw new RouteError("IMAGE_FETCH_FAILED", 502, "The proxied resource did not return an image.");
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": CACHE_CONTROL_HEADER,
        ...(upstream.headers.get("content-length") ? { "content-length": upstream.headers.get("content-length")! } : {}),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

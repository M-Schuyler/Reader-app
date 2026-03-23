import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { captureUrl } from "@/server/modules/capture/capture.service";

type CaptureUrlBody = {
  url?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CaptureUrlBody;

    if (typeof body?.url !== "string") {
      throw new RouteError("INVALID_BODY", 400, "Request body must include a string url.");
    }

    const data = await captureUrl(body.url);

    return ok(data, {
      status: data.deduped ? 200 : 201,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return handleRouteError(new RouteError("INVALID_JSON", 400, "Request body must be valid JSON."));
    }

    return handleRouteError(error);
  }
}


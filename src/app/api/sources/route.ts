import { handleRouteError, ok } from "@/server/api/response";
import { readJsonBodyOrThrow } from "@/server/api/request";
import { requireApiUser } from "@/server/auth/session";
import { createSource, getSources, parseCreateSourceInput } from "@/server/modules/sources/source.service";

export async function GET() {
  try {
    await requireApiUser();
    const data = await getSources();
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await readJsonBodyOrThrow(request);
    const input = parseCreateSourceInput(body);
    const data = await createSource(input);
    return ok(data, {
      status: data.deduped ? 200 : 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

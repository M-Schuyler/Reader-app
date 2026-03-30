import { handleRouteError, ok, RouteError } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { syncSource } from "@/server/modules/sources/source.service";

type SourceSyncRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: SourceSyncRouteProps) {
  try {
    await requireApiUser();
    const { id } = await params;
    const data = await syncSource(id);

    if (!data) {
      throw new RouteError("SOURCE_NOT_FOUND", 404, "Source was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

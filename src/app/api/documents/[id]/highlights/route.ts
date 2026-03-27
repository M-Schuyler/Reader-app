import { readJsonBodyOrThrow } from "@/server/api/request";
import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { isHighlightsQaFixtureId } from "@/lib/highlights/fixture-document";
import { isQaRealDocumentId } from "@/lib/highlights/qa-real-document";
import { requireApiUser } from "@/server/auth/session";
import {
  addDocumentHighlight,
  getDocumentHighlights,
  parseCreateHighlightInput,
} from "@/server/modules/highlights/highlight.service";
import {
  addQaRealDocumentHighlight,
  getQaRealDocumentHighlights,
} from "@/server/modules/highlights/highlight-qa-real.service";
import {
  addQaDocumentHighlight,
  assertQaFixtureEnabled,
  getQaDocumentHighlights,
} from "@/server/modules/highlights/highlight-qa-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (isHighlightsQaFixtureId(id)) {
      assertQaFixtureEnabled();
      return ok(await getQaDocumentHighlights());
    }

    if (isQaRealDocumentId(id)) {
      assertQaFixtureEnabled();
      return ok(await getQaRealDocumentHighlights(id));
    }

    await requireApiUser();
    const data = await getDocumentHighlights(id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = parseCreateHighlightInput(
      await readJsonBodyOrThrow(request, "Highlight payload must be valid JSON."),
    );

    if (isHighlightsQaFixtureId(id)) {
      assertQaFixtureEnabled();
      return ok(await addQaDocumentHighlight(input), { status: 201 });
    }

    if (isQaRealDocumentId(id)) {
      assertQaFixtureEnabled();
      const data = await addQaRealDocumentHighlight(id, input);

      if (!data) {
        throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
      }

      return ok(data, { status: 201 });
    }

    await requireApiUser();
    const data = await addDocumentHighlight(id, input);

    if (!data) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    return ok(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { readJsonBodyOrThrow } from "@/server/api/request";
import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { isQaRealHighlightId } from "@/lib/highlights/qa-real-document";
import { requireApiUser } from "@/server/auth/session";
import {
  editHighlight,
  parseUpdateHighlightInput,
  removeHighlight,
} from "@/server/modules/highlights/highlight.service";
import { editQaRealHighlight, removeQaRealHighlight } from "@/server/modules/highlights/highlight-qa-real.service";
import {
  assertQaFixtureEnabled,
  editQaHighlight,
  isQaHighlightId,
  removeQaHighlight,
} from "@/server/modules/highlights/highlight-qa-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = parseUpdateHighlightInput(
      await readJsonBodyOrThrow(request, "Highlight update payload must be valid JSON."),
    );

    if (isQaHighlightId(id)) {
      assertQaFixtureEnabled();
      const data = await editQaHighlight(id, input);

      if (!data) {
        throw new RouteError("HIGHLIGHT_NOT_FOUND", 404, "Highlight was not found.");
      }

      return ok(data);
    }

    if (isQaRealHighlightId(id)) {
      assertQaFixtureEnabled();
      const data = await editQaRealHighlight(id, input);

      if (!data) {
        throw new RouteError("HIGHLIGHT_NOT_FOUND", 404, "Highlight was not found.");
      }

      return ok(data);
    }

    await requireApiUser();
    const data = await editHighlight(id, input);

    if (!data) {
      throw new RouteError("HIGHLIGHT_NOT_FOUND", 404, "Highlight was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (isQaHighlightId(id)) {
      assertQaFixtureEnabled();
      const data = await removeQaHighlight(id);

      if (!data) {
        throw new RouteError("HIGHLIGHT_NOT_FOUND", 404, "Highlight was not found.");
      }

      return ok(data);
    }

    if (isQaRealHighlightId(id)) {
      assertQaFixtureEnabled();
      const data = await removeQaRealHighlight(id);

      if (!data) {
        throw new RouteError("HIGHLIGHT_NOT_FOUND", 404, "Highlight was not found.");
      }

      return ok(data);
    }

    await requireApiUser();
    const data = await removeHighlight(id);

    if (!data) {
      throw new RouteError("HIGHLIGHT_NOT_FOUND", 404, "Highlight was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

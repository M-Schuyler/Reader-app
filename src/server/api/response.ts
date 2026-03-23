import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export class RouteError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "RouteError";
    this.code = code;
    this.status = status;
  }
}

export function ok<T>(
  data: T,
  options?: {
    status?: number;
    meta?: Record<string, unknown>;
  },
) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      ok: true,
      data,
      ...(options?.meta ? { meta: options.meta } : {}),
    },
    { status: options?.status ?? 200 },
  );
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return fail(error.code, error.message, error.status);
  }

  console.error(error);
  return fail("INTERNAL_ERROR", "Internal server error.", 500);
}


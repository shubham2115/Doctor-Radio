import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/server/rate-limit";

export class HttpError extends Error {
  constructor(public status: number, message: string, public fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

/** CSRF defence for cookie-authenticated mutations: require same-origin Origin header. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Missing origin");
  if (new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request blocked");
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  }
  return parsed.data;
}

export async function limit(req: Request, bucket: string, max: number, windowSec: number) {
  const r = await rateLimit(`${bucket}:${clientIp(req)}`, max, windowSec);
  if (!r.ok) throw new HttpError(429, `Too many requests. Try again in ${r.retryAfter}s.`);
}

/** Wraps a route handler with uniform error → JSON mapping. */
export function route(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, fieldErrors: err.fieldErrors }, { status: err.status });
      }
      console.error("[api] unhandled", err);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

/** Like `route`, for handlers with dynamic segments: `params` is awaited and passed in resolved. */
export function routeWith<P extends Record<string, string>>(handler: (req: Request, params: P) => Promise<Response>) {
  return (req: Request, ctx: { params: Promise<P> }) => route(async (r) => handler(r, await ctx.params))(req);
}

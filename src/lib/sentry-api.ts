import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

/**
 * Wraps an App Router API route handler with Sentry error logging.
 * Usage:
 *   export const GET = withSentryAPI("/api/tasks", async (req) => { ... })
 */
export function withSentryAPI(
  routeName: string,
  handler: (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  // Create a wrapper that captures errors and adds Sentry context
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    return Sentry.startSpan(
      {
        name: `${req.method} ${routeName}`,
        op: "http.server",
        attributes: {
          "http.method": req.method,
          "http.route": routeName,
        },
      },
      async (span) => {
        try {
          const response = await handler(req, context);
          
          // Add response status to span
          span?.setAttribute("http.status_code", response.status);
          
          // Log error responses
          if (response.status >= 500) {
            Sentry.addBreadcrumb({
              category: "api",
              message: `API error response: ${routeName}`,
              level: "error",
              data: { route: routeName, status: response.status, method: req.method },
            });
          }
          
          return response;
        } catch (error) {
          // Capture exception with context
          Sentry.captureException(error, {
            tags: {
              route: routeName,
              method: req.method,
            },
            extra: {
              url: req.url,
              headers: Object.fromEntries(req.headers.entries()),
            },
          });
          
          // Re-throw to let Next.js handle it
          throw error;
        }
      }
    );
  };
}

/**
 * Lightweight wrapper for API routes that don't need full Sentry transaction.
 * Use this for simple routes where you just want error capture.
 */
export function withErrorLogging<T extends any[]>(
  routeName: string,
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Log to console for local debugging
      console.error(`[API Error] ${routeName}:`, error);
      
      // Send to Sentry
      Sentry.captureException(error, {
        tags: {
          route: routeName,
        },
        extra: {
          timestamp: new Date().toISOString(),
        },
      });
      
      // Return a generic error response (don't leak sensitive info)
      const message = error instanceof Error ? error.message : "Internal server error";
      return NextResponse.json(
        { error: "An unexpected error occurred. Please try again later." },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware function to add to existing route handlers for error logging.
 * Usage in a route.ts:
 *   export async function GET(req: NextRequest) {
 *     return withErrorLogging("/api/tasks", async () => { ... })(req);
 *   }
 */
export function captureAPIError(error: unknown, context: { route: string; method: string; url?: string }) {
  console.error(`[API Error] ${context.method} ${context.route}:`, error);
  
  Sentry.captureException(error, {
    tags: {
      route: context.route,
      method: context.method,
    },
    extra: {
      url: context.url,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Sanitize error message for user-facing responses.
 * Removes sensitive information like tokens, passwords, internal paths.
 */
export function sanitizeErrorMessage(message: string): string {
  // List of patterns to redact
  const sensitivePatterns = [
    /[a-zA-Z0-9_-]{20,}/g,  // Long tokens/keys
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-style keys
    /Bearer\s+[a-zA-Z0-9_-]+/gi, // Bearer tokens
    /password["'\s:=]+[^"'\s]+/gi, // Passwords
    /secret["'\s:=]+[^"'\s]+/gi, // Secrets
    /\/[^/\s]+\.env/gi, // .env file paths
    /postgres(?:ql)?:\/\/[^/\s]+/gi, // Database URLs
  ];
  
  let sanitized = message;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  
  return sanitized;
}

/**
 * Create a user-safe error response
 */
export function createErrorResponse(error: unknown, fallbackMessage = "An unexpected error occurred"): NextResponse {
  const message = error instanceof Error ? sanitizeErrorMessage(error.message) : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withErrorLogging, createErrorResponse } from "@/lib/sentry-api";

/**
 * Test endpoint to verify Sentry error logging works.
 * 
 * GET /api/debug/sentry-test?type=sync - Tests synchronous error
 * GET /api/debug/sentry-test?type=async - Tests async error
 * GET /api/debug/sentry-test?type=validation - Tests validation error (400)
 * GET /api/debug/sentry-test?type=manual - Tests manual error capture
 */
export const GET = withErrorLogging("/api/debug/sentry-test", async (req) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "sync";

  switch (type) {
    case "sync":
      // Synchronous error - thrown directly
      throw new Error("Test synchronous error for Sentry verification");

    case "async":
      // Async error - rejected promise
      await Promise.reject(new Error("Test async error for Sentry verification"));

    case "validation":
      // Validation error - 400 response (not captured as exception)
      return NextResponse.json(
        { error: "Invalid input: 'test' parameter is required" },
        { status: 400 }
      );

    case "manual":
      // Manual error capture with custom context
      try {
        throw new Error("Manual capture test error");
      } catch (error) {
        // This demonstrates manual capture with createErrorResponse
        return createErrorResponse(error, "Manual test error captured");
      }

    case "breadcrumbs":
      // Test breadcrumb logging
      Sentry.addBreadcrumb({
        category: "test",
        message: "Test breadcrumb before error",
        level: "info",
        data: { test: true },
      });
      throw new Error("Error after breadcrumb test");

    default:
      return NextResponse.json({ 
        message: "Sentry test endpoint",
        usage: "Add ?type=sync|async|validation|manual|breadcrumbs to test different error types",
      });
  }
});
import { NextResponse } from "next/server";

// Reuse the same data fetching logic as /api/home
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Set up SSE headers
  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");
  // No CORS headers — same-origin only (consumed by dashboard-ws.ts EventSource)

  // Create a readable stream
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data immediately
      const initialData = await fetchHomeData(request);
      controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`);

      const sendUpdate = async () => {
        try {
          const data = await fetchHomeData(request);
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          console.error("Error fetching data for SSE:", error);
          // Don't break the stream on error
        }
      };

      // Set up periodic updates (every 30s as fallback)
      const intervalId = setInterval(sendUpdate, 30_000);

      // No second "catch early changes" frame. The connect frame above and this
      // interval are both served by /api/home, which is cached for
      // CACHE_TTL.DYNAMIC (60s) — so a re-send 1s later returned a byte-identical
      // ~81KB payload and re-rendered the whole home tree for nothing. Measured
      // 3/3 connections sending 2 frames before this was removed. If early-change
      // catching is ever wanted, lower the /api/home cache TTL instead, so the
      // interval picks up real changes rather than replaying a cached one.

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, { headers });
}

async function fetchHomeData(request: Request) {
  // Reuse the same logic from GET /api/home but adapted for SSE
  // For now, we'll proxy to the existing endpoint logic
  const url = new URL(request.url);
  url.pathname = "/api/home";

  const res = await fetch(url.toString(), {
    headers: request.headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch home data: ${res.status}`);
  }

  return res.json();
}
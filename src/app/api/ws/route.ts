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

      // Also send an immediate update after 1 second to catch early changes
      setTimeout(sendUpdate, 1000);

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
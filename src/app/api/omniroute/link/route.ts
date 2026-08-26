import { NextResponse } from "next/server";

// Redirect to the OmniRoute dashboard analytics. URL comes from env so it
// works whether the dashboard is opened on the Mac itself or over Tailscale.
export function GET(request: Request) {
  const base = process.env.OMNIROUTE_URL || "http://localhost:20128";
  const url = new URL("/dashboard/analytics", base);
  return NextResponse.redirect(url, { status: 307 });
}

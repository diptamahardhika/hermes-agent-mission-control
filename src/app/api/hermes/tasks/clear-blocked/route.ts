import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    const result = await prisma.hermesTask.deleteMany({
      where: {
        status: "blocked",
      },
    });
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to clear blocked tasks:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

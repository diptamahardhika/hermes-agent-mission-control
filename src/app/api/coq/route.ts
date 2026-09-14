import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const DATA_PATH = join(process.cwd(), "data", "coq-finance.json");

interface FinanceCategory {
  name: string;
  spent: number;
  budget: number;
  color: string;
}

interface FinanceData {
  spending: { total: number; byCategory: FinanceCategory[] };
  budget: { totalBudget: number; remaining: number; percentageUsed: number };
  days: { date: string; amount: number }[];
}

export async function GET() {
  try {
    const data = await readFinanceData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(emptyState());
  }
}

async function readFinanceData(): Promise<FinanceData> {
  try {
    const raw = await readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw) as FinanceData;
  } catch {
    return emptyState();
  }
}

function emptyState(): FinanceData {
  return { spending: { total: 0, byCategory: [] }, budget: { totalBudget: 0, remaining: 0, percentageUsed: 0 }, days: [] };
}

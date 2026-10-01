import { NextResponse } from "next/server";
import { getPublishedPortfolio } from "@/app/portfolio/portfolio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const document = await getPublishedPortfolio();
  return NextResponse.json({ document });
}

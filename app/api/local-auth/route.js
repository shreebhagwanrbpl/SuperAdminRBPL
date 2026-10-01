import { GET as getHandler, POST as postHandler } from "@/app/api/auth/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  return getHandler(request, context);
}

export async function POST(request, context) {
  return postHandler(request, context);
}

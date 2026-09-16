import { BUILD_ID } from "@/lib/build-id";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { buildId: BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

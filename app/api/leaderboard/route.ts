import { NextRequest, NextResponse } from "next/server";

// Backend URL (using environment variable is recommended)
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// API route to fetch leaderboard data
export async function GET(req: NextRequest) {
  const roundId = req.nextUrl.searchParams.get("roundId");
  if (!roundId) {
    return NextResponse.json(
      { success: false, error: "'roundId' parameter is required" },
      { status: 400 }
    );
  }

  const requestId = `LEAD-${Math.floor(Math.random() * 100000)}`;
  // console.log(
  //   `[Next API ${requestId}] /leaderboard?roundId=${roundId} request started`
  // );

  try {
    // Assuming the backend endpoint is /api/leaderboard, adjust if different
    const backendUrl = `${BACKEND_URL}/api/leaderboard?roundId=${roundId}`;
    const response = await fetch(backendUrl, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        "X-Request-ID": requestId,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend response error: ${response.status}`);
    }

    const data = await response.json();
    // console.log(
    //   `[Next API ${requestId}] Received leaderboard from backend, length=${data?.leaderboard?.length}`
    // );
    // Ensure the response structure matches what the frontend expects
    return NextResponse.json({
      success: true,
      roundId: data.roundId,
      leaderboard: data.leaderboard,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Next API ${requestId}] Backend connection failed:`,
      errorMessage
    );
    // Fallback: return empty array (frontend should handle "no data")
    return NextResponse.json(
      {
        success: false,
        error: "Backend connection failed",
        errorDetail: errorMessage,
        leaderboard: [],
      },
      { status: 503 } // Service Unavailable
    );
  }
}

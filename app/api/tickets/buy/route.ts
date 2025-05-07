import { NextRequest, NextResponse } from "next/server";

// Actual backend server URL
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  const requestId = `BUY-PROXY-${Math.floor(Math.random() * 100000)}`;
  // console.log(`[Next API Proxy ${requestId}] Received request for /api/tickets/buy`);

  try {
    const body = await req.json();
    // console.log(`[Next API Proxy ${requestId}] Received data:`, body);

    // Validate required data
    if (!body.address || !body.roundId || !body.quantity || !body.totalValue) {
      return NextResponse.json(
        { success: false, error: "Missing required data" },
        { status: 400 }
      );
    }

    // Forward request to the actual backend server
    const backendUrl = `${BACKEND_URL}/api/tickets/buy`;
    // console.log(`[Next API Proxy ${requestId}] Calling backend: ${backendUrl}`);

    const backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId, // Forward request ID for tracing
      },
      body: JSON.stringify(body), // Forward the received data
      cache: "no-store",
    });

    // Check backend response status
    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      console.error(
        `[Next API Proxy ${requestId}] Backend responded with error ${backendRes.status}: ${errorText}`
      );
      return NextResponse.json(
        { success: false, error: `Backend error: ${errorText}` },
        { status: backendRes.status }
      );
    }

    // Forward backend response to the client
    const backendData = await backendRes.json();
    // console.log(
    //   `[Next API Proxy ${requestId}] Backend responded successfully, forwarding to client:`,
    //   backendData
    // );
    return NextResponse.json(backendData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown internal error";
    console.error(
      `[Next API Proxy ${requestId}] Error during processing:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        errorDetail: errorMessage,
      },
      { status: 500 }
    );
  }
}

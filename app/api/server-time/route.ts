import { NextResponse } from "next/server";

// Backend server URL (using environment variable is recommended)
const BACKEND_URL = "http://localhost:3001";

// Request tracking counters
let apiRequestCount = 0;
let lastBackendSuccess = false;
let lastRequestTime = 0;

export async function GET() {
  const requestStart = Date.now();
  apiRequestCount++;

  const requestId = `REQ-${apiRequestCount}-${Math.floor(
    Math.random() * 1000
  )}`;
  // console.log(
  //   `[Next API ${requestId}] Requesting server time from backend (${apiRequestCount})`
  // );

  try {
    const now = Date.now();
    const timeSinceLastRequest =
      lastRequestTime > 0 ? now - lastRequestTime : 0;
    lastRequestTime = now;

    // Fetch time information from backend server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Shortened timeout to 2 seconds

    const response = await fetch(`${BACKEND_URL}/api/server-time`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        "X-Request-ID": requestId,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Backend server response error: ${response.status}`);
    }

    const data = await response.json();
    lastBackendSuccess = true;

    const requestDuration = Date.now() - requestStart;
    // console.log(
    //   `[Next API ${requestId}] Successfully received backend time: ${data.iso} (Duration: ${requestDuration}ms, Interval: ${timeSinceLastRequest}ms)`
    // );

    // Include additional info in the response from backend server
    const enhancedData = {
      ...data,
      nextApiInfo: {
        requestId,
        requestDuration,
        timeSinceLastRequest,
        requestCount: apiRequestCount,
      },
    };

    return NextResponse.json(enhancedData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Next API ${requestId}] Error fetching server time from backend: ${errorMessage}`
    );

    // Fallback to Next.js server time if backend connection fails
    const now = new Date();
    const fallbackData = {
      timestamp: Math.floor(now.getTime() / 1000),
      milliseconds: now.getTime(),
      iso: now.toISOString(),
      source: "next-fallback", // Indicate this is fallback data
      nextApiInfo: {
        requestId,
        requestCount: apiRequestCount,
        lastBackendSuccess,
        timeSinceLastRequest:
          lastRequestTime > 0 ? Date.now() - lastRequestTime : 0,
        error: errorMessage,
      },
    };

    lastBackendSuccess = false;
    return NextResponse.json(fallbackData, { status: 200 }); // Return 200 OK with fallback data
  }
}

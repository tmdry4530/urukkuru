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

  const requestId = `STATUS-${apiRequestCount}-${Math.floor(
    Math.random() * 1000
  )}`;
  // console.log(
  //   `[Next API ${requestId}] Requesting status from backend (${apiRequestCount})`
  // );

  try {
    const now = Date.now();
    const timeSinceLastRequest =
      lastRequestTime > 0 ? now - lastRequestTime : 0;
    lastRequestTime = now;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

    // console.log(
    //   `[Next API ${requestId}] Backend URL: ${BACKEND_URL}/api/status`
    // );

    try {
      const response = await fetch(`${BACKEND_URL}/api/status`, {
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
        throw new Error(
          `Backend server responded with error: ${response.status}`
        );
      }

      const responseText = await response.text();
      // console.log(`[Next API ${requestId}] Raw backend response:`, responseText);

      if (!responseText || responseText.trim() === "") {
        throw new Error("Backend server returned an empty response");
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[Next API ${requestId}] JSON parse error:`, parseError);
        throw new Error(
          `Could not parse backend response as JSON: ${responseText.substring(
            0,
            100
          )}...`
        );
      }

      if (!data.roundInfo || typeof data.roundInfo !== "object") {
        console.error(
          `[Next API ${requestId}] Missing 'roundInfo' field in backend response:`,
          data
        );
        throw new Error("Backend response missing required 'roundInfo' field");
      }

      const requiredFields = [
        "currentRoundId",
        "nextDrawTime",
        "timeRemaining",
        "roundEndTimestamp",
      ];
      const missingFields = requiredFields.filter(
        (field) => data.roundInfo[field] === undefined
      );
      if (missingFields.length > 0) {
        console.error(
          `[Next API ${requestId}] Missing required fields in 'roundInfo':`,
          missingFields
        );
        throw new Error(
          `Missing required fields in 'roundInfo': ${missingFields.join(", ")}`
        );
      }

      lastBackendSuccess = true;

      const requestDuration = Date.now() - requestStart;
      // console.log(
      //   `[Next API ${requestId}] Successfully received status from backend: roundId=${data.roundInfo.currentRoundId || "undefined"} (Duration: ${requestDuration}ms, Interval: ${timeSinceLastRequest}ms)`
      // );

      const enhancedData = {
        ...data,
        nextApiInfo: {
          requestId,
          requestDuration,
          timeSinceLastRequest,
          requestCount: apiRequestCount,
        },
      };

      // console.log(
      //   `[Next API ${requestId}] Final returned data:`,
      //   JSON.stringify(enhancedData).substring(0, 200) + "..."
      // );
      return NextResponse.json(enhancedData);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Next API ${requestId}] Error fetching status from backend: ${errorMessage}`
    );

    const errorResponse = {
      success: false,
      error: "Failed to connect to backend server",
      errorDetail: errorMessage,
      nextApiInfo: {
        requestId,
        requestCount: apiRequestCount,
        lastBackendSuccess,
      },
    };

    lastBackendSuccess = false;
    // console.log(
    //   `[Next API ${requestId}] Returning error response:`,
    //   JSON.stringify(errorResponse).substring(0, 200) + "..."
    // );
    return NextResponse.json(errorResponse, { status: 503 }); // 503 Service Unavailable
  }
}

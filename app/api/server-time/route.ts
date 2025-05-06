import { NextResponse } from "next/server";

// 백엔드 서버 URL (환경 변수로 관리하는 것이 좋음)
const BACKEND_URL = "http://localhost:3001";

// 요청 추적을 위한 카운터
let apiRequestCount = 0;
let lastBackendSuccess = false;
let lastRequestTime = 0;

export async function GET() {
  const requestStart = Date.now();
  apiRequestCount++;

  const requestId = `REQ-${apiRequestCount}-${Math.floor(
    Math.random() * 1000
  )}`;
  console.log(
    `[Next API ${requestId}] 백엔드 서버에 시간 요청 시작 (${apiRequestCount}번째 요청)`
  );

  try {
    // 요청 간격 확인 (디버깅용)
    const now = Date.now();
    const timeSinceLastRequest =
      lastRequestTime > 0 ? now - lastRequestTime : 0;
    lastRequestTime = now;

    // 백엔드 서버에서 시간 정보 가져오기
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2초로 타임아웃 단축

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
      throw new Error(`백엔드 서버 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    lastBackendSuccess = true;

    const requestDuration = Date.now() - requestStart;
    console.log(
      `[Next API ${requestId}] 백엔드 시간 수신 성공: ${data.iso} (소요시간: ${requestDuration}ms, 요청 간격: ${timeSinceLastRequest}ms)`
    );

    // 백엔드 서버 응답에 추가 정보 포함하여 전달
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
      error instanceof Error ? error.message : "알 수 없는 오류";
    console.error(
      `[Next API ${requestId}] 백엔드 서버 시간 가져오기 오류: ${errorMessage}`
    );

    // 백엔드 연결 실패 시 Next.js 서버 시간으로 대체 (폴백)
    const now = new Date();
    const fallbackData = {
      timestamp: Math.floor(now.getTime() / 1000),
      milliseconds: now.getTime(),
      iso: now.toISOString(),
      source: "next-fallback",
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
    return NextResponse.json(fallbackData, { status: 200 });
  }
}

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

  const requestId = `STATUS-${apiRequestCount}-${Math.floor(
    Math.random() * 1000
  )}`;
  console.log(
    `[Next API ${requestId}] 백엔드 서버에 상태 요청 시작 (${apiRequestCount}번째 요청)`
  );

  try {
    // 요청 간격 확인 (디버깅용)
    const now = Date.now();
    const timeSinceLastRequest =
      lastRequestTime > 0 ? now - lastRequestTime : 0;
    lastRequestTime = now;

    // 백엔드 서버에서 상태 정보 가져오기
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초로 타임아웃 설정

    console.log(
      `[Next API ${requestId}] 백엔드 URL: ${BACKEND_URL}/api/status`
    );

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
        throw new Error(`백엔드 서버 응답 오류: ${response.status}`);
      }

      // 응답 텍스트를 먼저 가져와서 로깅
      const responseText = await response.text();
      console.log(`[Next API ${requestId}] 백엔드 응답 원본:`, responseText);

      // 비어 있는 응답 체크
      if (!responseText || responseText.trim() === "") {
        throw new Error("백엔드 서버가 빈 응답을 반환했습니다");
      }

      // 텍스트를 JSON으로 파싱
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[Next API ${requestId}] JSON 파싱 오류:`, parseError);
        throw new Error(
          `백엔드 응답을 JSON으로 파싱할 수 없음: ${responseText.substring(
            0,
            100
          )}...`
        );
      }

      // roundInfo 필드가 없는 경우, 오류 처리
      if (!data.roundInfo || typeof data.roundInfo !== "object") {
        console.error(
          `[Next API ${requestId}] 백엔드 응답에 roundInfo 필드 없음:`,
          data
        );
        throw new Error("백엔드 응답에 필수 roundInfo 필드가 없습니다");
      }

      // 필수 roundInfo 속성 체크
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
          `[Next API ${requestId}] roundInfo에 필수 필드 누락:`,
          missingFields
        );
        throw new Error(
          `roundInfo에 필수 필드 누락: ${missingFields.join(", ")}`
        );
      }

      lastBackendSuccess = true;

      const requestDuration = Date.now() - requestStart;
      console.log(
        `[Next API ${requestId}] 백엔드 상태 수신 성공: roundId=${
          data.roundInfo.currentRoundId || "undefined"
        } (소요시간: ${requestDuration}ms, 요청 간격: ${timeSinceLastRequest}ms)`
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

      console.log(
        `[Next API ${requestId}] 최종 반환 데이터:`,
        JSON.stringify(enhancedData).substring(0, 200) + "..."
      );
      return NextResponse.json(enhancedData);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError; // 외부 catch 블록으로 전달
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    console.error(
      `[Next API ${requestId}] 백엔드 서버 상태 가져오기 오류: ${errorMessage}`
    );

    // 백엔드 연결 실패 시 오류 응답 반환 (임시 데이터 생성 대신)
    const errorResponse = {
      success: false,
      error: "백엔드 서버 연결 실패",
      errorDetail: errorMessage,
      nextApiInfo: {
        requestId,
        requestCount: apiRequestCount,
        lastBackendSuccess,
      },
    };

    lastBackendSuccess = false;
    console.log(
      `[Next API ${requestId}] 오류 응답 반환:`,
      JSON.stringify(errorResponse).substring(0, 200) + "..."
    );
    return NextResponse.json(errorResponse, { status: 503 }); // 503 Service Unavailable
  }
}

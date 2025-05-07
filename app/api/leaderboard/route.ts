import { NextRequest, NextResponse } from "next/server";

// 백엔드 BE URL (환경 변수 사용 권장)
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// 리더보드 데이터를 가져오는 API 라우트
export async function GET(req: NextRequest) {
  const roundId = req.nextUrl.searchParams.get("roundId");
  if (!roundId) {
    return NextResponse.json(
      { success: false, error: "roundId 파라미터가 필요합니다" },
      { status: 400 }
    );
  }

  const requestId = `LEAD-${Math.floor(Math.random() * 100000)}`;
  console.log(
    `[Next API ${requestId}] /leaderboard?roundId=${roundId} 요청 시작`
  );

  try {
    const backendUrl = `${BACKEND_URL}/leaders?roundId=${roundId}`;
    const response = await fetch(backendUrl, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        "X-Request-ID": requestId,
      },
    });

    if (!response.ok) {
      throw new Error(`백엔드 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `[Next API ${requestId}] 백엔드 리더보드 수신 성공, length=${data?.length}`
    );
    return NextResponse.json({ success: true, leaderboard: data });
  } catch (error) {
    console.error(`[Next API ${requestId}] 백엔드 연결 실패:`, error);
    // 폴백: 빈 배열 반환 (프론트엔드에서 "데이터 없음" 표시)
    return NextResponse.json(
      {
        success: false,
        error: "백엔드 연결 실패",
        leaderboard: [],
      },
      { status: 503 }
    );
  }
}

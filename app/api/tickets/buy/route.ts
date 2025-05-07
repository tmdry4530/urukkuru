import { NextRequest, NextResponse } from "next/server";

// 실제 백엔드 서버 URL
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  const requestId = `BUY-PROXY-${Math.floor(Math.random() * 100000)}`;
  console.log(`[Next API Proxy ${requestId}] /api/tickets/buy 요청 수신`);

  try {
    const body = await req.json();
    console.log(`[Next API Proxy ${requestId}] 수신 데이터:`, body);

    // 필수 데이터 확인
    if (!body.address || !body.roundId || !body.quantity || !body.totalValue) {
      return NextResponse.json(
        { success: false, error: "필수 데이터 누락" },
        { status: 400 }
      );
    }

    // 실제 백엔드 서버로 요청 전달
    const backendUrl = `${BACKEND_URL}/api/tickets/buy`;
    console.log(`[Next API Proxy ${requestId}] 백엔드 호출: ${backendUrl}`);

    const backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId, // 추적 ID 전달
      },
      body: JSON.stringify(body), // 받은 데이터 그대로 전달
      cache: "no-store",
    });

    // 백엔드 응답 상태 확인
    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      console.error(
        `[Next API Proxy ${requestId}] 백엔드 응답 오류 ${backendRes.status}: ${errorText}`
      );
      return NextResponse.json(
        { success: false, error: `백엔드 오류: ${errorText}` },
        { status: backendRes.status }
      );
    }

    // 백엔드 응답을 클라이언트에 그대로 전달
    const backendData = await backendRes.json();
    console.log(
      `[Next API Proxy ${requestId}] 백엔드 응답 성공, 클라이언트에 전달:`,
      backendData
    );
    return NextResponse.json(backendData);
  } catch (error) {
    console.error(`[Next API Proxy ${requestId}] 처리 중 오류:`, error);
    return NextResponse.json(
      { success: false, error: "내부 서버 오류" },
      { status: 500 }
    );
  }
}

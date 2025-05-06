import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("roundId");

  console.log("[API Leaderboard] Requested roundId:", roundId);

  // TODO: 실제 데이터베이스 또는 소스에서 리더보드 데이터를 가져옵니다.
  // 이 예시에서는 목업 데이터를 반환합니다.
  if (roundId) {
    // 특정 라운드에 대한 목업 데이터 (실제로는 DB 조회 등 필요)
    // 실제 LeaderboardEntry 타입과 일치하도록 반환
    const mockLeaderboardData: {
      rank: number;
      address: string;
      tickets: number | string;
    }[] = [
      {
        rank: 1,
        address: "0x1234567890123456789012345678901234567890",
        tickets: 100,
      },
      {
        rank: 2,
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        tickets: 90,
      },
      {
        rank: 3,
        address: "0x0987654321098765432109876543210987654321",
        tickets: 80,
      },
      {
        rank: 4,
        address: "0xfedcbafedcbafedcbafedcbafedcbafedcbafed",
        tickets: 75,
      },
      {
        rank: 5,
        address: "0x11223344556677889900aabbccddeeff11223344",
        tickets: 70,
      },
    ];
    return NextResponse.json(mockLeaderboardData);
  } else {
    // roundId가 제공되지 않은 경우 빈 배열 또는 에러 반환
    return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  }
}

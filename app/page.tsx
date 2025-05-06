"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { PageLayout } from "@/components/page-layout";
import {
  useAccount,
  useWalletClient,
  useSimulateContract,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useChainId,
  useChains,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import toast from "react-hot-toast";

// UrukLottery 컨트랙트 ABI
import UrukLotteryABIFile from "@/abi/UrukLottery.abi.json";
const UrukLotteryABI = UrukLotteryABIFile.abi as any[];

// TODO: 실제 URUK 토큰 ABI로 교체 필수! (json 파일 import 권장)
// 표준 JSON ABI 형식으로 수정
const UrukTokenABI: any[] = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

const lotteryAddress = process.env.NEXT_PUBLIC_LOTTERY_ADDR as
  | `0x${string}`
  | undefined;
const urukTokenAddress = process.env.NEXT_PUBLIC_URUK_TOKEN as
  | `0x${string}`
  | undefined;
const targetChainIdFromEnv = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "10143",
  10
); // 기본값 Monad Testnet ID, 10진수

// TODO: 실제 리더보드 API 엔드포인트 URL로 변경 필요
const LEADERBOARD_API_URL = "/api/leaderboard?roundId="; // 예시 API 경로

// 주소 축약 유틸리티 함수
const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};

// API 응답 데이터 타입 정의 (실제 API 응답 구조에 맞게 수정 필요)
interface LeaderboardEntry {
  rank: number;
  address: string;
  tickets: number | string; // API 응답 형식에 따라 number 또는 string
}

// 블록 탐색기 URL 생성 함수 (Monad Testnet 기준)
const getExplorerUrl = (txHash: string) =>
  `https://testnet.monadexplorer.com/tx/${txHash}`;

// 이벤트 리스너를 통한 리더보드 데이터 구성을 위한 인터페이스
interface TicketPurchaseEvent {
  roundId: bigint;
  player: string;
  tickets: bigint;
  paid: bigint;
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [countdown, setCountdown] = useState<{
    minutes: number;
    seconds: number;
  } | null>(null);
  const [roundEndTime, setRoundEndTime] = useState<number | null>(null); // Unix timestamp (seconds)
  // 서버 시간과 로컬 시간의 차이 저장 (단위: 초)
  const [timeOffset, setTimeOffset] = useState<number>(0);
  // 마지막으로 처리된 라운드 ID를 저장
  const [lastProcessedRoundId, setLastProcessedRoundId] = useState<
    string | null
  >(null);
  // 새 라운드 알림 표시 여부 제어
  const [showingNewRoundAlert, setShowingNewRoundAlert] =
    useState<boolean>(false);

  const [quantity, setQuantity] = useState("");
  const [glowIntensity, setGlowIntensity] = useState(1);

  const [isTransactionProcessing, setIsTransactionProcessing] = useState(false);
  const [currentTransactionStep, setCurrentTransactionStep] = useState<
    | ""
    | "preparing"
    | "approving"
    | "buying"
    | "startingBuySimulation"
    | "completed"
    | "error"
  >("");

  // Leaderboard State
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    []
  );
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const {
    address: accountAddress,
    isConnected,
    chain: accountChain,
  } = useAccount();
  const currentChainId = useChainId();
  const availableChains = useChains();

  const targetChain = availableChains.find(
    (c) => c.id === targetChainIdFromEnv
  );
  const isCorrectNetwork = currentChainId === targetChainIdFromEnv;

  // URUK Token Balance and Decimals
  const { data: urukDecimalsData, isLoading: isLoadingUrukDecimals } =
    useReadContract({
      address: urukTokenAddress,
      abi: UrukTokenABI,
      functionName: "decimals",
      chainId: targetChainIdFromEnv,
      query: {
        enabled:
          !!urukTokenAddress && isConnected && isCorrectNetwork && isClient,
        staleTime: 1000 * 60,
      },
    });
  const urukDecimals =
    typeof urukDecimalsData === "number"
      ? urukDecimalsData
      : typeof urukDecimalsData === "bigint"
      ? Number(urukDecimalsData)
      : undefined;

  const {
    data: urukBalanceData,
    isLoading: isLoadingUrukBalance,
    refetch: refetchUrukBalance,
  } = useReadContract({
    address: urukTokenAddress,
    abi: UrukTokenABI,
    functionName: "balanceOf",
    args: accountAddress ? [accountAddress] : undefined,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!urukTokenAddress &&
        !!accountAddress &&
        urukDecimals !== undefined &&
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60,
    },
  });
  const urukBalance = urukBalanceData as bigint | undefined;

  const urukBalanceFormatted =
    urukBalance !== undefined && urukDecimals !== undefined
      ? formatUnits(urukBalance, urukDecimals)
      : "0";

  // URUK Token Allowance
  const {
    data: urukAllowanceData,
    isLoading: isLoadingUrukAllowance,
    refetch: refetchUrukAllowance,
  } = useReadContract({
    address: urukTokenAddress,
    abi: UrukTokenABI,
    functionName: "allowance",
    args:
      accountAddress && lotteryAddress
        ? [accountAddress, lotteryAddress]
        : undefined,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!urukTokenAddress &&
        !!accountAddress &&
        !!lotteryAddress &&
        urukDecimals !== undefined &&
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60,
    },
  });
  const urukAllowance = urukAllowanceData as bigint | undefined;

  useEffect(() => {
    if (urukAllowance !== undefined) {
      console.log(
        "[EFFECT urukAllowance] Current urukAllowance:",
        urukAllowance.toString(),
        "Decimals:",
        urukDecimals
      );
      if (urukDecimals !== undefined) {
        console.log(
          "[EFFECT urukAllowance] Formatted urukAllowance:",
          formatUnits(urukAllowance, urukDecimals)
        );
      }
    }
  }, [urukAllowance, urukDecimals]);

  // Get Active Round ID
  const {
    data: activeRoundIdData,
    isLoading: isLoadingActiveRound,
    refetch: refetchActiveRound,
  } = useReadContract({
    address: lotteryAddress,
    abi: UrukLotteryABI,
    functionName: "activeRoundId",
    chainId: targetChainIdFromEnv,
    query: {
      enabled: !!lotteryAddress && isConnected && isCorrectNetwork && isClient,
      staleTime: 1000 * 60 * 3, // 3분으로 증가 (RPC 요청 최적화)
    },
  });
  const activeRoundId = activeRoundIdData as bigint | undefined;

  // Get Round End Time using roundEnd function
  const {
    data: roundEndTimeData,
    isLoading: isLoadingEndTime,
    refetch: refetchEndTime,
  } = useReadContract({
    address: lotteryAddress,
    abi: UrukLotteryABI,
    functionName: "roundEnd",
    args: activeRoundId !== undefined ? [activeRoundId] : undefined,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!lotteryAddress &&
        activeRoundId !== undefined &&
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60 * 3, // 3분으로 증가 (RPC 요청 최적화)
    },
  });

  // Set roundEndTime state when data is available
  useEffect(() => {
    if (roundEndTimeData !== undefined && roundEndTimeData !== null) {
      try {
        // Ensure conversion from potential bigint to number
        setRoundEndTime(Number(roundEndTimeData));
      } catch (e) {
        console.error("Error converting roundEndTimeData to number:", e);
        setRoundEndTime(null);
      }
    } else {
      setRoundEndTime(null);
    }
  }, [roundEndTimeData]);

  // Get Owned Tickets for the active round (using the newly added getTicketsOf)
  const {
    data: ownedTicketsData,
    isLoading: isLoadingOwnedTickets,
    refetch: refetchOwnedTickets,
  } = useReadContract({
    address: lotteryAddress,
    abi: UrukLotteryABI,
    functionName: "getTicketsOf",
    args:
      accountAddress && activeRoundId !== undefined
        ? [accountAddress, activeRoundId]
        : undefined,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!lotteryAddress &&
        !!accountAddress &&
        activeRoundId !== undefined &&
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60,
    },
  });
  const ownedTickets = ownedTicketsData as bigint | undefined;

  // --- 로터리 풀의 URUK 잔액 (총 상금) ---
  const {
    data: lotteryPoolBalanceData,
    isLoading: isLoadingLotteryPoolBalance,
    refetch: refetchLotteryPoolBalance,
  } = useReadContract({
    address: urukTokenAddress,
    abi: UrukTokenABI,
    functionName: "balanceOf",
    args: lotteryAddress ? [lotteryAddress] : undefined,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!urukTokenAddress &&
        !!lotteryAddress &&
        urukDecimals !== undefined &&
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60,
    },
  });
  const lotteryPoolBalance = lotteryPoolBalanceData as bigint | undefined;

  const lotteryPoolBalanceFormatted =
    lotteryPoolBalance !== undefined && urukDecimals !== undefined
      ? formatUnits(lotteryPoolBalance, urukDecimals) // 소수점 포맷은 필요에 따라 조정
      : "0";

  // --- Approve Transaction ---
  const [approveArgs, setApproveArgs] = useState<
    [`0x${string}`, bigint] | undefined
  >();
  const {
    data: approveConfig,
    error: approveErrorSimulate,
    isLoading: isLoadingApproveSimulate,
  } = useSimulateContract({
    address: urukTokenAddress,
    abi: UrukTokenABI,
    functionName: "approve",
    args: approveArgs,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!urukTokenAddress &&
        approveArgs !== undefined &&
        isCorrectNetwork &&
        isConnected,
    },
  });
  const {
    writeContractAsync: approveAsync,
    data: approveData,
    reset: resetApprove,
    isPending: isApproving,
  } = useWriteContract();

  const { isLoading: isConfirmingApprove, isSuccess: isSuccessApprove } =
    useWaitForTransactionReceipt({
      hash: approveData,
      confirmations: 1,
      chainId: targetChainIdFromEnv,
    });

  // --- Buy Tickets Transaction ---
  const [buyTicketsArgs, setBuyTicketsArgs] = useState<[bigint] | undefined>();
  const {
    data: buyTicketsConfig,
    error: buyTicketsErrorSimulate,
    isLoading: isLoadingBuyTicketsSimulate,
  } = useSimulateContract({
    address: lotteryAddress,
    abi: UrukLotteryABI,
    functionName: "buyTickets",
    args: buyTicketsArgs,
    account: accountAddress,
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!lotteryAddress &&
        !!buyTicketsArgs &&
        !!accountAddress &&
        currentTransactionStep === "startingBuySimulation" &&
        isCorrectNetwork &&
        isConnected &&
        !isLoadingUrukAllowance,
    },
  });
  const {
    writeContractAsync: buyTicketsAsync,
    data: buyTicketsData,
    reset: resetBuyTickets,
    isPending: isBuyingTickets,
  } = useWriteContract();

  const { isLoading: isConfirmingBuyTickets, isSuccess: isSuccessBuyTickets } =
    useWaitForTransactionReceipt({
      hash: buyTicketsData,
      confirmations: 1,
      chainId: targetChainIdFromEnv,
    });

  // 트랜잭션 성공 후 데이터 갱신을 위한 useEffect 추가
  useEffect(() => {
    if (isSuccessBuyTickets) {
      console.log(
        "[TransactionSuccess] 티켓 구매 트랜잭션 성공, 데이터 갱신 시작"
      );

      // 토스트 메시지로 성공 알림
      toast.success("티켓 구매 완료! 데이터를 갱신합니다...");

      // 상태 변경
      setCurrentTransactionStep("completed");
      setIsTransactionProcessing(false);

      // 약간의 지연 후 데이터 갱신 (블록체인 상태 반영 시간 고려)
      setTimeout(async () => {
        try {
          // 소유한 티켓 수량 갱신
          const ticketsResult = await refetchOwnedTickets();
          console.log("[DataRefresh] 티켓 수량 갱신 결과:", ticketsResult);

          // 로터리 풀 잔액(총 상금) 갱신
          const poolResult = await refetchLotteryPoolBalance();
          console.log("[DataRefresh] 로터리 풀 잔액 갱신 결과:", poolResult);

          // URUK 토큰 잔액 갱신
          await refetchUrukBalance();

          // URUK 토큰 허용량 갱신
          await refetchUrukAllowance();

          toast.success("데이터 갱신 완료!");
        } catch (error) {
          console.error("[DataRefresh] 데이터 갱신 중 오류 발생:", error);
          toast.error(
            "일부 데이터를 갱신하지 못했습니다. 페이지를 새로고침해 보세요."
          );
        }
      }, 2000); // 2초 지연
    }
  }, [
    isSuccessBuyTickets,
    refetchOwnedTickets,
    refetchLotteryPoolBalance,
    refetchUrukBalance,
    refetchUrukAllowance,
  ]);

  // Animate glow effect (기존 로직 유지)
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowIntensity((prev) => {
        const newValue = prev + 0.05 * (Math.random() > 0.5 ? 1 : -1);
        return Math.max(0.8, Math.min(1.2, newValue));
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // 서버 시간을 가져오는 함수
  const fetchServerTime = useCallback(async () => {
    try {
      // Next.js API 경로를 통해 백엔드 서버 시간 요청
      const response = await fetch("/api/server-time", {
        cache: "no-store", // 항상 최신 데이터
        headers: { "Cache-Control": "no-cache" },
      });

      if (!response.ok) {
        throw new Error("서버 시간 가져오기 실패");
      }
      const data = await response.json();

      // 시간 출처 확인 (백엔드 또는 Next.js 폴백)
      const timeSource =
        data.source === "next-fallback" ? "Next.js 폴백" : "백엔드 서버";

      // 서버 시간과 로컬 시간의 차이 계산 (초 단위)
      const localTime = Math.floor(Date.now() / 1000);
      const serverTime = data.timestamp;
      const offset = serverTime - localTime;

      console.log(
        `[ServerTime] ${timeSource} 시간: ${serverTime}, 로컬 시간: ${localTime}, 오프셋: ${offset}초`
      );

      // 백엔드 연결이 안 됐을 경우 경고 표시 (선택적)
      if (data.source === "next-fallback") {
        console.warn(
          "[ServerTime] 백엔드 서버에 연결할 수 없어 Next.js 서버 시간을 사용합니다."
        );
      }

      setTimeOffset(offset);

      return { serverTime, offset, source: timeSource };
    } catch (error) {
      console.error("[ServerTime] 서버 시간 가져오기 오류:", error);
      // 오류 발생 시 오프셋 0으로 설정하여 로컬 시간 사용
      return {
        serverTime: Math.floor(Date.now() / 1000),
        offset: 0,
        source: "로컬 시간(오류)",
      };
    }
  }, []);

  // 컴포넌트 마운트 시 서버 시간 동기화
  useEffect(() => {
    if (isClient) {
      console.log("[ServerTime] 초기 서버 시간 동기화 시작");
      // 초기 로드 시 서버 시간 가져오기
      fetchServerTime();

      // 2분마다 서버 시간 재동기화 (기존 1분에서 변경)
      const syncInterval = setInterval(() => {
        console.log("[ServerTime] 정기 서버 시간 동기화 실행");
        fetchServerTime();
      }, 120000); // 2분으로 증가

      return () => clearInterval(syncInterval);
    }
  }, [isClient, fetchServerTime]);

  // UPDATED: Countdown timer - 서버 시간 기준 적용
  const calculateCountdown = useCallback(() => {
    if (roundEndTime === null || roundEndTime === undefined) {
      setCountdown(null);
      return true; // Indicate timer should stop if no end time
    }

    // 오프셋이 적용된 현재 시간 계산 (서버 시간 기준)
    const now = Math.floor(Date.now() / 1000) + timeOffset;
    const remainingSeconds = roundEndTime - now;

    // 디버깅용 로그 출력 빈도 조절 (10초 간격 또는 마지막 5초만)
    if (remainingSeconds % 10 === 0 || remainingSeconds <= 5) {
      console.log(
        `[Countdown] 현재 라운드 종료 시간: ${roundEndTime}, 현재 시간(서버 기준): ${now}, 남은 시간: ${remainingSeconds}초`
      );
    }

    if (remainingSeconds <= 0) {
      setCountdown({ minutes: 0, seconds: 0 });
      return true;
    } else {
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      setCountdown({ minutes, seconds });
      return false;
    }
  }, [roundEndTime, timeOffset]);

  useEffect(() => {
    // 이미 처리 중인지 확인하는 플래그
    let isProcessing = false;

    const stopped = calculateCountdown();
    if (stopped) {
      // 카운트다운이 종료되었을 때 새 라운드 정보 갱신
      const refreshRoundData = async () => {
        // 이미 처리 중이거나 알림을 표시 중인 경우 건너뜀
        if (isProcessing || showingNewRoundAlert) {
          console.log(
            "[Countdown] 이미 처리 중이거나 알림을 표시 중이므로 중복 처리 방지"
          );
          return;
        }

        isProcessing = true;
        console.log("[Countdown] 카운트다운 종료, 새 라운드 정보 갱신");

        try {
          // 활성 라운드 ID 갱신 (서버 시간 동기화 즉시 호출 방지)
          if (activeRoundId !== undefined) {
            const currentRoundIdStr = activeRoundId.toString();
            console.log("[Countdown] 현재 라운드:", currentRoundIdStr);

            // 이미 처리한 라운드인지 확인
            if (lastProcessedRoundId === currentRoundIdStr) {
              console.log(
                `[Countdown] 라운드 ID ${currentRoundIdStr}는 이미 처리됨. 중복 알림 방지`
              );
              isProcessing = false;
              return;
            }

            // 중복 알림 방지를 위해 상태 설정
            setShowingNewRoundAlert(true);

            // 2초 기다린 후 새 라운드 정보 로드 (블록체인 상태 반영 시간 고려)
            setTimeout(async () => {
              try {
                // 라운드 정보 새로고침
                const result = await refetchActiveRound();
                const newRoundId = result.data?.toString();
                console.log("[Countdown] 새 활성 라운드 ID:", newRoundId);

                // 현재 라운드 ID와 새로 받은 라운드 ID 비교
                if (newRoundId && newRoundId !== lastProcessedRoundId) {
                  // 새 라운드 ID 저장
                  setLastProcessedRoundId(newRoundId);

                  // 종료 시간 정보 새로고침
                  const endTimeResult = await refetchEndTime();
                  console.log(
                    "[Countdown] 새 라운드 종료 시간:",
                    endTimeResult.data
                  );

                  // 다른 정보도 함께 갱신
                  await refetchOwnedTickets();
                  await refetchLotteryPoolBalance();

                  // 서버 시간 동기화 (마지막에 한 번만 호출)
                  await fetchServerTime();

                  toast.success("새 라운드가 시작되었습니다!");
                } else {
                  console.log(
                    "[Countdown] 라운드 ID가 변경되지 않았거나 이미 처리된 라운드, 알림 표시 안함"
                  );
                }
              } catch (error) {
                console.error("[Countdown] 새 라운드 데이터 갱신 오류:", error);
              } finally {
                // 알림 표시 상태 초기화 (3초 후)
                setTimeout(() => {
                  setShowingNewRoundAlert(false);
                  isProcessing = false;
                }, 3000);
              }
            }, 2000);
          }
        } catch (error) {
          console.error("[Countdown] 라운드 정보 갱신 중 오류:", error);
          // 오류 발생 시 알림 표시 상태 초기화
          setShowingNewRoundAlert(false);
          isProcessing = false;
        }
      };

      // 카운트다운이 끝났을 때만 갱신 실행
      if (countdown?.minutes === 0 && countdown?.seconds === 0) {
        refreshRoundData();
      }

      return;
    }

    const timer = setInterval(() => {
      if (calculateCountdown()) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    calculateCountdown,
    countdown,
    activeRoundId,
    refetchActiveRound,
    refetchEndTime,
    refetchOwnedTickets,
    refetchLotteryPoolBalance,
    fetchServerTime,
    lastProcessedRoundId,
    showingNewRoundAlert,
  ]);

  // Fetch Leaderboard Data (직접 컨트랙트에서 참여자 정보 가져오기)
  useEffect(() => {
    if (
      activeRoundId !== undefined &&
      lotteryAddress &&
      isClient &&
      isCorrectNetwork
    ) {
      const fetchLeaderboardData = async () => {
        setIsLoadingLeaderboard(true);
        setLeaderboardError(null);

        try {
          console.log(
            "[Leaderboard] Fetching leaderboard for round:",
            activeRoundId.toString()
          );

          // 직접 RPC 호출로 참가자 목록 가져오기
          const entries: LeaderboardEntry[] = [];

          // 현재 사용자가 있고 티켓이 있는 경우만 추가
          if (accountAddress && ownedTickets && ownedTickets > BigInt(0)) {
            entries.push({
              rank: 0, // 나중에 순위 계산
              address: accountAddress,
              tickets: ownedTickets.toString(),
            });

            console.log(
              "[Leaderboard] Added current user's tickets:",
              ownedTickets.toString()
            );
          }

          // 가상 데이터 생성 코드 제거 (테스트 데이터 더 이상 사용하지 않음)
          // 실제 컨트랙트 이벤트나 데이터 필요시 여기에 구현

          // 티켓 수에 따라 내림차순 정렬
          entries.sort((a, b) => {
            const ticketsA = BigInt(a.tickets.toString());
            const ticketsB = BigInt(b.tickets.toString());
            return ticketsB > ticketsA ? 1 : ticketsB < ticketsA ? -1 : 0;
          });

          // 순위 부여
          entries.forEach((entry, index) => {
            entry.rank = index + 1;
          });

          setLeaderboardData(entries);
          setLeaderboardError(null);

          console.log("[Leaderboard] Processed entries:", entries);
        } catch (error) {
          console.error("[Leaderboard] Error fetching leaderboard:", error);
          setLeaderboardError(
            "리더보드 데이터를 불러오는 중 오류가 발생했습니다."
          );
          setLeaderboardData([]);
        } finally {
          setIsLoadingLeaderboard(false);
        }
      };

      // 초기 데이터 로드
      fetchLeaderboardData();

      // 30초마다 자동 새로고침
      const intervalId = setInterval(fetchLeaderboardData, 30000);

      // 클린업 함수
      return () => clearInterval(intervalId);
    } else {
      // 필요한 데이터가 없을 경우 로딩 상태로 표시
      setIsLoadingLeaderboard(true);
      setLeaderboardData([]);
    }
  }, [
    activeRoundId,
    lotteryAddress,
    isClient,
    isCorrectNetwork,
    accountAddress,
    ownedTickets,
  ]);

  // 클라이언트 객체 초기화를 위한 헬퍼 함수
  const waitForClient = async () => {
    try {
      // viem 또는 wagmi에서 제공하는 클라이언트 객체 가져오기
      const { createPublicClient, http } = await import("viem");
      const publicClient = createPublicClient({
        chain: {
          id: targetChainIdFromEnv,
          name: targetChain?.name || "Unknown Chain",
          nativeCurrency: {
            name: "MONAD",
            symbol: "MONAD",
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: ["https://rpc.monadcloud.org/testnet"],
            },
            public: {
              http: ["https://rpc.monadcloud.org/testnet"],
            },
          },
        },
        transport: http("https://rpc.monadcloud.org/testnet"),
      });
      return publicClient;
    } catch (error) {
      console.error("Error initializing public client:", error);
      return null;
    }
  };

  // 바로 이 아래에 handleQuantityChange 함수를 추가합니다.
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^[0-9]+$/.test(value)) {
      if (value.length > 1 && value.startsWith("0")) {
        setQuantity(value.substring(1));
      } else if (value === "0") {
        setQuantity("");
      } else {
        setQuantity(value);
      }
    }
  };

  // 바로 이 아래에 handleSubmitTickets 함수를 추가합니다.
  const handleSubmitTickets = async () => {
    if (!isConnected || !accountAddress) {
      toast.error("지갑을 연결해주세요.");
      return;
    }
    if (!isCorrectNetwork) {
      toast.error(
        `네트워크를 ${
          targetChain?.name || `Chain ID: ${targetChainIdFromEnv}`
        }으로 변경해주세요.`
      );
      return;
    }
    if (!lotteryAddress || !urukTokenAddress) {
      toast.error(
        "컨트랙트 주소가 설정되지 않았습니다. 관리자에게 문의하세요."
      );
      return;
    }
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      toast.error("유효한 수량을 입력해주세요 (1 이상의 정수).");
      return;
    }
    if (urukDecimals === undefined) {
      toast.error("토큰 정보를 읽어오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setApproveArgs(undefined);
    setBuyTicketsArgs(undefined);
    resetApprove();
    resetBuyTickets();
    setIsTransactionProcessing(true);
    setCurrentTransactionStep("preparing");
    console.log("[handleSubmitTickets] Start. Quantity:", numQuantity);

    try {
      // 1 URUK = 1 티켓이라고 가정. 티켓당 가격.
      const pricePerTicket = parseUnits("1", urukDecimals);
      // 사용자가 구매하려는 총 티켓 수 (BigInt)
      const ticketsToBuyBigInt = BigInt(numQuantity);
      // 실제로 필요한 총 URUK 양
      const amountNeeded = ticketsToBuyBigInt * pricePerTicket;

      console.log(
        `[handleSubmitTickets] Tickets to buy: ${ticketsToBuyBigInt}, Price per ticket: ${pricePerTicket}, Amount needed: ${amountNeeded}`
      );

      const refetchToastId = toast.loading("최신 토큰 허용량을 확인합니다...");
      const {
        data: currentAllowanceUnknown,
        isError: isRefetchError,
        error: refetchError,
      } = await refetchUrukAllowance();

      if (
        isRefetchError ||
        currentAllowanceUnknown === undefined ||
        typeof currentAllowanceUnknown !== "bigint"
      ) {
        console.error(
          "[handleSubmitTickets] Error refetching allowance or invalid data:",
          refetchError,
          currentAllowanceUnknown
        );
        const errorMsg =
          (refetchError as any)?.shortMessage ||
          (refetchError as Error)?.message ||
          "알 수 없는 오류";
        toast.error(`최신 허용량 확인 실패: ${errorMsg}`, {
          id: refetchToastId,
        });
        setCurrentTransactionStep("error");
        setIsTransactionProcessing(false);
        return;
      }

      const currentAllowance = currentAllowanceUnknown as bigint;
      toast.success("최신 허용량 확인 완료!", { id: refetchToastId });
      console.log(
        `[handleSubmitTickets] Fetched current allowance: ${formatUnits(
          currentAllowance,
          urukDecimals
        )} URUK. Amount needed: ${formatUnits(amountNeeded, urukDecimals)} URUK`
      );

      // 수정된 조건: 현재 허용량이 실제 필요한 총액보다 적은 경우 approve
      if (currentAllowance < amountNeeded) {
        console.log(
          `[handleSubmitTickets] Allowance ${formatUnits(
            currentAllowance,
            urukDecimals
          )} URUK is < Amount needed ${formatUnits(
            amountNeeded,
            urukDecimals
          )} URUK. Approving MaxUint256.`
        );
        setCurrentTransactionStep("approving");
        setApproveArgs([lotteryAddress!, maxUint256]);
      } else {
        console.log(
          `[handleSubmitTickets] Allowance ${formatUnits(
            currentAllowance,
            urukDecimals
          )} URUK is sufficient for ${formatUnits(
            amountNeeded,
            urukDecimals
          )} URUK. Simulating buyTickets.`
        );
        // buyTickets 함수는 티켓 개수를 받는다고 가정
        setBuyTicketsArgs([ticketsToBuyBigInt]);

        // 명시적으로 상태 변경 딜레이를 줘서 상태 업데이트가 확실히 반영되도록 함
        setTimeout(() => {
          console.log(
            "[handleSubmitTickets] Setting transaction step to startingBuySimulation"
          );
          setCurrentTransactionStep("startingBuySimulation");
        }, 500);
      }
    } catch (error: any) {
      console.error("[handleSubmitTickets] Error:", error);
      toast.error(`티켓 준비 중 오류: ${error.message || "알 수 없는 오류"}`);
      setCurrentTransactionStep("error");
      setIsTransactionProcessing(false);
    }
  };

  // 로딩 메시지 또는 버튼 비활성화 로직 수정
  let submitButtonText = "Submit";
  if (isClient) {
    if (isTransactionProcessing) {
      if (currentTransactionStep === "approving")
        submitButtonText = "승인 중...";
      else if (currentTransactionStep === "buying")
        submitButtonText = "구매 중...";
      else if (currentTransactionStep === "startingBuySimulation")
        submitButtonText = "준비 중... (시뮬)";
      else if (currentTransactionStep === "preparing")
        submitButtonText = "준비 중...";
      else submitButtonText = "처리 중...";
    } else if (currentTransactionStep === "completed") {
      submitButtonText = "구매 완료!";
    } else if (currentTransactionStep === "error") {
      submitButtonText = "오류 발생";
    }
  }

  const isSubmitButtonDisabled =
    !isClient ||
    isTransactionProcessing ||
    !isConnected ||
    !isCorrectNetwork ||
    isLoadingApproveSimulate ||
    isLoadingBuyTicketsSimulate ||
    isLoadingUrukAllowance;

  // Format countdown for display
  const countdownDisplay = countdown
    ? `${String(countdown.minutes).padStart(2, "0")}:${String(
        countdown.seconds
      ).padStart(2, "0")}`
    : "--:--"; // 로딩 또는 종료 시 표시
  const isCountdownLoading =
    isLoadingActiveRound || isLoadingEndTime || countdown === null;

  // 8. isTransactionProcessing 상태 관리 (단순화)
  useEffect(() => {
    const processing =
      isApproving ||
      isConfirmingApprove ||
      isBuyingTickets ||
      isConfirmingBuyTickets;
    if (isTransactionProcessing !== processing) {
      setIsTransactionProcessing(processing);
    }
  }, [
    isApproving,
    isConfirmingApprove,
    isBuyingTickets,
    isConfirmingBuyTickets,
    isTransactionProcessing,
    setIsTransactionProcessing,
  ]);

  // DEBUG: useEffect to log critical enabled conditions
  useEffect(() => {
    console.log("--- DEBUG: Enabled Conditions Check ---");
    console.log("isClient:", isClient);
    console.log("isConnected:", isConnected);
    console.log("isCorrectNetwork:", isCorrectNetwork);
    console.log("accountAddress:", accountAddress);
    console.log("lotteryAddress:", lotteryAddress);
    console.log("urukTokenAddress:", urukTokenAddress);
    console.log("urukDecimals:", urukDecimals);
    console.log("activeRoundId (data):", activeRoundIdData); // useReadContract의 data 직접 로깅
    console.log("activeRoundId (processed):", activeRoundId);
    console.log("--- END DEBUG ---");
  }, [
    isClient,
    isConnected,
    isCorrectNetwork,
    accountAddress,
    lotteryAddress,
    urukTokenAddress,
    urukDecimals,
    activeRoundIdData, // activeRoundIdData를 의존성 배열에 추가
    activeRoundId,
  ]);

  useEffect(() => {
    console.log("[useEffect setIsClient] Mount effect triggered."); // 로그 추가
    setIsClient(true);
    console.log("[useEffect setIsClient] setIsClient(true) called."); // 로그 추가
  }, []);

  // 티켓 구매 트랜잭션 시뮬레이션 및 단계 전환
  useEffect(() => {
    // 로딩이 끝났을 때만 검사
    console.log(
      "[SimulateEffect] Status check - Loading:",
      isLoadingBuyTicketsSimulate,
      "Step:",
      currentTransactionStep,
      "Config:",
      !!buyTicketsConfig?.request,
      "Error:",
      !!buyTicketsErrorSimulate
    );

    if (!isLoadingBuyTicketsSimulate) {
      if (
        buyTicketsConfig?.request &&
        !buyTicketsErrorSimulate &&
        currentTransactionStep === "startingBuySimulation"
      ) {
        console.log(
          "[SimulateEffect] 시뮬레이션 성공. 'startingBuySimulation'에서 'buying'으로 전환. Request:",
          buyTicketsConfig.request
        );
        setCurrentTransactionStep("buying");
      } else if (
        buyTicketsErrorSimulate &&
        currentTransactionStep === "startingBuySimulation"
      ) {
        // 시뮬레이션 오류 처리
        console.error(
          "[SimulateEffect] 시뮬레이션 실패. 오류:",
          buyTicketsErrorSimulate
        );
        const errorMsg =
          (buyTicketsErrorSimulate as any)?.shortMessage ||
          buyTicketsErrorSimulate?.message ||
          "알 수 없는 오류";
        toast.error(`티켓 구매 시뮬레이션 실패: ${errorMsg}`);
        setCurrentTransactionStep("error");
        setIsTransactionProcessing(false);
      }
    }
  }, [
    isLoadingBuyTicketsSimulate,
    buyTicketsConfig,
    buyTicketsErrorSimulate,
    currentTransactionStep,
    setCurrentTransactionStep,
    setIsTransactionProcessing,
  ]);

  // 티켓 구매 트랜잭션 실행 (개선된 통합 버전)
  useEffect(() => {
    // 상태 로깅
    console.log(
      "[BuyTransaction] 상태 확인 - 단계:",
      currentTransactionStep,
      "Args:",
      buyTicketsArgs,
      "요청생성:",
      !!buyTicketsConfig?.request,
      "전송중:",
      isBuyingTickets,
      "전송완료:",
      !!buyTicketsData,
      "로딩중:",
      isLoadingBuyTicketsSimulate
    );

    // 조건: 티켓 구매 단계에서 트랜잭션 전송
    if (
      currentTransactionStep === "buying" &&
      buyTicketsConfig?.request &&
      buyTicketsArgs &&
      !isBuyingTickets &&
      !buyTicketsData
    ) {
      console.log(
        "[BuyTransaction] 티켓 구매 트랜잭션 조건 충족, 트랜잭션 전송 시작"
      );

      // 트랜잭션 실행
      (async () => {
        const toastId = "buy-tickets-tx";
        try {
          toast.loading("티켓 구매 트랜잭션 전송 중...", { id: toastId });

          // 트랜잭션 전송
          await buyTicketsAsync(buyTicketsConfig.request);

          console.log("[BuyTransaction] 트랜잭션 전송 성공");
          // 트랜잭션 확인은 isSuccessBuyTickets useEffect에서 처리
        } catch (error) {
          console.error("[BuyTransaction] 트랜잭션 전송 실패:", error);
          const errorMsg =
            (error as any)?.shortMessage ||
            (error as Error)?.message ||
            "알 수 없는 오류";
          toast.error(`티켓 구매 실패: ${errorMsg}`, { id: toastId });

          // 오류 발생 시 상태 초기화
          setCurrentTransactionStep("error");
          setIsTransactionProcessing(false);
        }
      })();
    }
  }, [
    buyTicketsConfig,
    buyTicketsAsync,
    buyTicketsArgs,
    currentTransactionStep,
    isBuyingTickets,
    buyTicketsData,
    isLoadingBuyTicketsSimulate,
    setCurrentTransactionStep,
    setIsTransactionProcessing,
  ]);

  return (
    <PageLayout>
      {/* Main Content Section */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-7 gap-4 mb-12">
        {/* GIF Container - md:col-span-2, items-start justify-center 로 변경 */}
        <div className="md:col-span-2 flex flex-col items-start justify-center">
          <div className="relative w-96 h-96">
            {" "}
            {/* GIF 이미지 크기 유지 */}
            <Image
              src="/URUK_1.gif"
              alt="URUK Cat Logo"
              width={640}
              height={640}
              className="object-contain"
              style={{
                filter: `drop-shadow(0 0 ${
                  10 * glowIntensity
                }px rgba(255, 0, 255, 0.7))`,
              }}
            />
          </div>
        </div>

        {/* Spacer for middle section - md:col-span-3에서 md:col-span-2로 변경 */}
        <div className="hidden md:block md:col-span-2"></div>

        {/* Right Column Data (Countdown + Leaderboard) - md:col-span-2에서 md:col-span-3로 변경 */}
        <div className="md:col-span-3 flex flex-col items-center gap-4">
          {/* UPDATED: Countdown Box - 총 상금 표시 수정 */}
          <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 flex flex-col items-center justify-center shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow w-full flex-1">
            <h3 className="text-lg font-medium text-purple-200 mb-1 font-joystix">
              countdown
            </h3>
            <div className="text-4xl font-bold text-white flex items-center mb-3 font-joystix">
              {isCountdownLoading ? (
                <span className="animate-pulse">--:--</span>
              ) : (
                <>
                  <span>
                    {String(countdown?.minutes ?? 0).padStart(2, "0")}
                  </span>
                  <span className="mx-1 animate-pulse">:</span>
                  <span>
                    {String(countdown?.seconds ?? 0).padStart(2, "0")}
                  </span>
                </>
              )}
            </div>
            <div className="text-center font-joystix">
              <span className="text-sm text-purple-200">Total Prize : </span>
              {isClient &&
              !isLoadingLotteryPoolBalance &&
              urukDecimals !== undefined ? (
                <span className="text-sm font-medium text-pink-400">
                  {parseFloat(lotteryPoolBalanceFormatted).toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits:
                        Number(
                          lotteryPoolBalanceFormatted.split(".")[1]?.length || 0
                        ) > 3
                          ? 2
                          : 0,
                    }
                  )}{" "}
                  $URUK
                  {/* 예: 1,234.56 $URUK 또는 1,000 $URUK (소수점 없을 시) */}
                </span>
              ) : (
                <span className="text-sm font-medium text-pink-400 animate-pulse">
                  Loading...
                </span>
              )}
            </div>
          </div>

          {/* UPDATED: Leaderboard Box */}
          <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow w-full flex-1 font-joystix">
            <h3 className="text-lg font-medium text-purple-200 mb-3 text-center">
              Leaderboard (Round #{activeRoundId?.toString() ?? "..."})
            </h3>
            <div className="space-y-2 min-h-[200px]">
              {" "}
              {/* 최소 높이 추가 */}
              {isLoadingLeaderboard ? (
                <div className="flex justify-center items-center h-full">
                  <p className="text-purple-300 animate-pulse">
                    Loading leaderboard...
                  </p>
                </div>
              ) : leaderboardError ? (
                <div className="flex justify-center items-center h-full">
                  <p className="text-red-400">{leaderboardError}</p>
                </div>
              ) : leaderboardData.length > 0 ? (
                leaderboardData.map((entry, index) => (
                  <div
                    key={entry.address || index}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="w-6 text-right mr-2">
                      {entry.rank || index + 1}.
                    </span>
                    <span
                      className="flex-1 truncate text-purple-300"
                      title={entry.address}
                    >
                      {truncateAddress(entry.address)}
                    </span>
                    <span className="ml-2 font-medium text-pink-400">
                      [{entry.tickets}]
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-full">
                  <p className="text-gray-400">
                    No leaderboard data available for this round.
                  </p>
                </div>
              )}
              {/* 만약 10개 미만일 경우 빈칸 채우기 (선택적) */}
              {/* {!isLoadingLeaderboard && leaderboardData.length < 10 && 
                  Array.from({ length: 10 - leaderboardData.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex justify-between items-center text-sm opacity-50">
                          <span className="w-6 text-right mr-2">{leaderboardData.length + i + 1}.</span>
                          <span className="flex-1 truncate text-gray-500">-</span>
                          <span className="ml-2 font-medium text-gray-500">[-]</span>
                      </div>
                  ))
              } */}
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
        <a
          href="https://www.kuru.io/trade/0x5d6506e92b0a1205bd717b66642e961edad0a884" // 이 주소는 $URUK 토큰의 거래소 주소인가요? 필요시 업데이트
          target="_blank"
          rel="noopener noreferrer"
          className="md:col-span-2"
        >
          <button className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-pink-600/30">
            Trade $URUK
          </button>
        </a>

        <div className="md:col-span-3 relative">
          <input
            type="number"
            value={quantity}
            onChange={handleQuantityChange}
            placeholder="Enter ticket quantity (e.g., 10)"
            min="1"
            step="1"
            className="w-full bg-black/30 border border-purple-500/50 rounded-md py-3 px-4 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
            disabled={!isClient || isTransactionProcessing}
            onKeyDown={(e) => {
              if (
                e.key === "." ||
                e.key === "," ||
                e.key === "-" ||
                e.key === "e" ||
                e.key === "E"
              ) {
                e.preventDefault();
              }
            }}
            suppressHydrationWarning={true}
          />
        </div>

        <button
          onClick={handleSubmitTickets}
          className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitButtonDisabled}
        >
          {submitButtonText}
        </button>
      </div>

      {/* Owned Tickets Display Section */}
      <div className="max-w-4xl mx-auto w-full mb-8 text-center">
        <p className="text-xl font-medium text-purple-200">
          My Ticket:{" "}
          {!isClient ||
          isLoadingOwnedTickets ||
          isLoadingActiveRound ||
          activeRoundId === undefined ? (
            <span className="text-2xl font-bold text-white">Loading...</span>
          ) : (
            <span className="text-2xl font-bold text-white">
              {ownedTickets?.toString() ?? "0"}
            </span>
          )}{" "}
          🎟️
        </p>
        {isClient && (
          <p className="text-xs text-purple-300 mt-1">
            (Current Allowance:{" "}
            {isLoadingUrukAllowance ||
            urukAllowance === undefined ||
            urukDecimals === undefined ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              `${formatUnits(urukAllowance, urukDecimals)} URUK`
            )}
            )
          </p>
        )}
      </div>

      {/* Description Section */}
      <div className="max-w-4xl mx-auto w-full mb-12">
        <h2 className="text-2xl font-bold mb-4 text-center">
          URUK URUK Wanna get a gift from the cutest cat ever? Grab a ticket
          with $URUK and take your shot at winning!
        </h2>
        <ul className="space-y-2 mb-8">
          {[
            "1 $URUK = 1 ticket.",
            "All  spent on tickets goes into the prize pool.",
            "One lucky winner gets the entire pool of $URUK.",
            " A winner is picked every 6 hours, and the prize gets airdropped straight to their wallet!",
          ].map((text, index) => (
            <li key={index} className="flex items-start">
              <span className="inline-block w-5 h-5 mr-2 rounded-full border border-pink-500 flex-shrink-0"></span>
              <span className="text-purple-200">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </PageLayout>
  );
}

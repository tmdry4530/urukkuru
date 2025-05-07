"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { useQueryClient } from "@tanstack/react-query";

// UrukLottery Contract ABI
import UrukLotteryABIFile from "@/abi/UrukLottery.abi.json";
const UrukLotteryABI = UrukLotteryABIFile.abi as any[];

// TODO: Replace with actual URUK Token ABI! (JSON file import recommended)
// Modified to standard JSON ABI format
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
); // Default Monad Testnet ID, decimal

// TODO: Change to actual leaderboard API endpoint URL
const LEADERBOARD_API_URL = "/api/leaderboard?roundId="; // Example API path

// Address truncation utility function
const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};

// API response data type definition (needs modification according to actual API response structure)
interface LeaderboardEntry {
  rank: number;
  address: string;
  tickets: number | string; // number or string depending on API response format
}

// Block explorer URL generation function (based on Monad Testnet)
const getExplorerUrl = (txHash: string) =>
  `https://testnet.monadexplorer.com/tx/${txHash}`;

// Interface for configuring leaderboard data via event listener
interface TicketPurchaseEvent {
  roundId: bigint;
  player: string;
  tickets: bigint;
  paid: bigint;
}

// Server-side round information
interface RoundInfo {
  currentRoundId: string;
  nextDrawTime: number;
  timeRemaining: number;
  roundEndTimestamp: number;
  roundStartTimestamp: number;
  roundDuration: number;
}

// Server status response
interface ServerStatus {
  success: boolean;
  currentRound: string;
  previousRound: string;
  serverTime: {
    timestamp: number;
    iso: string;
  };
  roundInfo: RoundInfo;
  fallbackMode?: boolean;
  errorDetail?: string;
  serverError?: boolean;
  message?: string;
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [countdown, setCountdown] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [roundEndTime, setRoundEndTime] = useState<number | null>(null); // Unix timestamp (seconds)
  // Store the difference between server time and local time (unit: seconds)
  const [timeOffset, setTimeOffset] = useState<number>(0);
  // Store the last processed round ID
  const [lastProcessedRoundId, setLastProcessedRoundId] = useState<
    string | null
  >(null);
  // Control whether to display the new round notification
  const [showingNewRoundAlert, setShowingNewRoundAlert] =
    useState<boolean>(false);
  // 티켓 구매 후 임시 티켓 수 표시용 상태
  const [pendingTicketCount, setPendingTicketCount] = useState<bigint | null>(
    null
  );

  const [quantity, setQuantity] = useState("");
  const [glowIntensity, setGlowIntensity] = useState(1);

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

  // 백엔드로부터 라운드 정보 가져오기
  const [serverRoundInfo, setServerRoundInfo] = useState<RoundInfo | null>(
    null
  );
  const [isLoadingServerInfo, setIsLoadingServerInfo] = useState(true);

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
      enabled: !!lotteryAddress && isCorrectNetwork && isClient,
      staleTime: 1000 * 60 * 60 * 6, // 6 hours
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
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60 * 60 * 6,
    },
  });

  // 디버그 로그 추가 - roundEndTimeData 값과 현재 시간 차이 확인
  useEffect(() => {
    if (roundEndTimeData !== undefined) {
      const now = Math.floor(Date.now() / 1000) + timeOffset;
      const endTime = Number(roundEndTimeData);
      const diff = endTime - now;
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      console.log(
        "[DEBUG] Contract roundEnd 원시 데이터:",
        roundEndTimeData.toString()
      );
      console.log(
        "[DEBUG] 변환된 종료 시간:",
        new Date(endTime * 1000).toISOString()
      );
      console.log("[DEBUG] 현재 시간:", new Date(now * 1000).toISOString());
      console.log(`[DEBUG] 남은 시간: ${hours}시간 ${minutes}분 (${diff}초)`);
      console.log("[DEBUG] ROUND_SPAN이 6시간인지 확인:");
      console.log("[DEBUG] 계약 값:", "6 hours");
    }
  }, [roundEndTimeData, timeOffset]);

  // Set roundEndTime state when data is available (modified part)
  useEffect(() => {
    if (roundEndTimeData !== undefined && roundEndTimeData !== null) {
      try {
        const newEndTime = Number(roundEndTimeData);
        // Update only if the current state is different from the new end time to prevent unnecessary re-renders
        if (roundEndTime !== newEndTime) {
          setRoundEndTime(newEndTime);
          console.log(
            "[EFFECT roundEndTimeData] New round end time set:",
            newEndTime,
            "from data:",
            roundEndTimeData
          );
        }
      } catch (e) {
        console.error(
          "[EFFECT roundEndTimeData] Error converting roundEndTimeData to number:",
          e
        );
        // 오류 발생 시에도, 현재 roundEndTime이 null이 아니라면 null로 설정하여 일관성 유지 시도
        if (roundEndTime !== null) setRoundEndTime(null);
      }
    } else if (roundEndTimeData === null && roundEndTime !== null) {
      // If the contract returns null (or 0), and the current state is not null (e.g., previous round value)
      // This case ensures that if the contract explicitly clears the end time, the state reflects it.
      setRoundEndTime(null);
      console.log(
        "[EFFECT roundEndTimeData] Round end time explicitly reset to null from contract data."
      );
    }
    // 의존성 배열에서 roundEndTime 제거. 오직 roundEndTimeData 변경에만 반응.
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
        isClient,
      staleTime: 1000 * 30, // 30초마다 갱신
    },
  });
  const ownedTickets = ownedTicketsData as bigint | undefined;

  // --- URUK balance of the lottery pool (total prize) ---
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
      ? formatUnits(lotteryPoolBalance, urukDecimals) // Adjust decimal format as needed
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
  const [buyTicketsArgs, setBuyTicketsArgs] = useState<
    [bigint, bigint] | undefined
  >();

  // 트랜잭션 시뮬레이션 및 실행 코드 최적화
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
        buyTicketsArgs.length === 2 &&
        !!accountAddress &&
        currentTransactionStep === "startingBuySimulation" &&
        isCorrectNetwork &&
        isConnected,
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

  // isTransactionProcessing 상태를 useMemo로 변경
  const isTransactionProcessing = useMemo(
    () =>
      isApproving ||
      isConfirmingApprove ||
      isBuyingTickets ||
      isConfirmingBuyTickets,
    [isApproving, isConfirmingApprove, isBuyingTickets, isConfirmingBuyTickets]
  );

  // 임시 상금 풀 값을 저장하기 위한 상태 추가
  const [pendingPoolBalance, setPendingPoolBalance] = useState<bigint | null>(
    null
  );

  // 상금 풀 표시 로직을 수정
  const displayedPoolBalance = useMemo(() => {
    // 1. 펜딩 값이 있으면 우선 표시
    if (pendingPoolBalance !== null && urukDecimals !== undefined) {
      return formatUnits(pendingPoolBalance, urukDecimals);
    }
    // 2. 아니면 실제 값 표시
    if (lotteryPoolBalance !== undefined && urukDecimals !== undefined) {
      return formatUnits(lotteryPoolBalance, urukDecimals);
    }
    // 3. 둘 다 없으면 0 표시
    return "0";
  }, [pendingPoolBalance, lotteryPoolBalance, urukDecimals]);

  // 티켓 구매 후 데이터 업데이트 로직 개선
  useEffect(() => {
    if (isSuccessBuyTickets && buyTicketsData) {
      console.log("[티켓구매성공] 트랜잭션 해시:", buyTicketsData);

      try {
        const numQuantity = parseInt(quantity, 10); // 현재 입력된 quantity를 사용
        if (!isNaN(numQuantity) && numQuantity > 0) {
          const newTicketsTotal =
            (ownedTickets || BigInt(0)) + BigInt(numQuantity);
          setPendingTicketCount(newTicketsTotal);
          console.log(
            `[티켓구매성공] 티켓 수 업데이트: ${
              ownedTickets || 0
            } + ${numQuantity} = ${newTicketsTotal}`
          );

          if (urukDecimals !== undefined) {
            const ticketPrice = parseUnits("1", urukDecimals);
            const ticketValue = BigInt(numQuantity) * ticketPrice;
            if (lotteryPoolBalance !== undefined) {
              const newPoolTotal = lotteryPoolBalance + ticketValue;
              setPendingPoolBalance(newPoolTotal);
              console.log(
                `[티켓구매성공] 임시 상금 풀 업데이트: ${formatUnits(
                  lotteryPoolBalance,
                  urukDecimals
                )} + ${numQuantity} = ${formatUnits(
                  newPoolTotal,
                  urukDecimals
                )}`
              );
            }
          }

          toast.success(`${numQuantity}장의 티켓을 성공적으로 구매했습니다!`);

          // 중요: 트랜잭션 성공 후 quantity 초기화
          setQuantity("");
          setCurrentTransactionStep("completed"); // 단계 완료로 설정

          setTimeout(async () => {
            try {
              const ticketResult = await refetchOwnedTickets();
              console.log(
                "[티켓구매성공] 티켓 데이터 새로고침 결과:",
                ticketResult
              );

              const poolResult = await refetchLotteryPoolBalance();
              console.log("[티켓구매성공] 상금 풀 새로고침 결과:", poolResult);

              const poolData = poolResult.data;
              if (poolData !== undefined) {
                try {
                  if (urukDecimals !== undefined) {
                    const poolBalanceBigInt = BigInt(
                      poolData as unknown as string | number | bigint
                    );
                    const formattedBalance = formatUnits(
                      poolBalanceBigInt,
                      urukDecimals
                    );
                    console.log(
                      "[티켓구매성공] 업데이트된 상금 풀:",
                      formattedBalance
                    );
                  }
                  setPendingPoolBalance(null);
                } catch (e) {
                  console.error("[티켓구매성공] 상금 풀 데이터 변환 오류:", e);
                }
              }

              if (ticketResult.data) {
                console.log(
                  "[티켓구매성공] 업데이트된 티켓 수:",
                  ticketResult.data.toString()
                );
                setPendingTicketCount(null); // 실제 데이터 반영 후 임시값 초기화
              }
            } catch (error) {
              console.error("[티켓구매성공] 데이터 갱신 중 오류:", error);
            }
          }, 2000);
        }
      } catch (error) {
        console.error("[티켓구매성공] 데이터 처리 중 오류:", error);
        // 오류 발생 시에도 quantity는 초기화하는 것이 좋을 수 있음 (선택적)
        // setQuantity("");
        setCurrentTransactionStep("error"); // 오류 상태로 명확히 설정
      }
    }
  }, [
    isSuccessBuyTickets,
    buyTicketsData,
    ownedTickets,
    lotteryPoolBalance,
    urukDecimals,
    refetchOwnedTickets,
    refetchLotteryPoolBalance,
  ]);

  // 백엔드에서 사용자 티켓 정보를 가져오는 함수
  const fetchUserTicketsFromBackend = useCallback(async () => {
    if (isClient && accountAddress && activeRoundId) {
      try {
        // 백엔드 API를 통해 리더보드 데이터 가져오기
        const apiUrl = `${LEADERBOARD_API_URL}${activeRoundId.toString()}`;
        console.log("[FetchTickets] 백엔드 API 요청 시작:", apiUrl);

        const response = await fetch(apiUrl, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }).catch((error) => {
          console.error("[FetchTickets] 네트워크 요청 실패:", error);
          return null;
        });

        if (!response) {
          console.error("[FetchTickets] 응답이 없습니다");
          return;
        }

        console.log(
          "[FetchTickets] 응답 상태:",
          response.status,
          response.statusText
        );

        if (response.ok) {
          const data = await response.json();
          console.log("[FetchTickets] 백엔드 응답 데이터:", data);

          if (data.success && data.leaderboard) {
            // 리더보드 데이터 갱신
            setLeaderboardData(data.leaderboard);
            console.log("[FetchTickets] 리더보드 데이터 설정 완료");

            // 사용자 티켓 정보 확인
            const userEntry = data.leaderboard.find(
              (entry: LeaderboardEntry) =>
                entry.address.toLowerCase() === accountAddress.toLowerCase()
            );

            if (userEntry) {
              console.log(
                `[FetchTickets] 사용자 티켓 수: ${userEntry.tickets}`
              );
            } else {
              console.log(
                "[FetchTickets] 리더보드에서 사용자 정보를 찾을 수 없습니다"
              );
            }
          } else {
            console.error("[FetchTickets] 데이터 형식 오류:", data);
          }
        } else {
          console.error("[FetchTickets] 응답 오류:", await response.text());
        }
      } catch (error) {
        console.error("[FetchTickets] 티켓 정보 가져오기 오류:", error);
      }
    } else {
      console.log("[FetchTickets] 조건 불충족:", {
        isClient,
        hasAccount: !!accountAddress,
        activeRoundId: activeRoundId?.toString(),
      });
    }
  }, [isClient, accountAddress, activeRoundId]);

  // 백엔드에서 티켓 정보를 가져오는 함수를 호출하는 부분 - hydration 이슈 방지
  useEffect(() => {
    // 컴포넌트 마운트 직후 즉시 한 번 호출 - 렌더링 사이클 이후로 지연
    if (isClient && accountAddress && activeRoundId) {
      console.log("[UseEffect] fetchUserTicketsFromBackend 호출 준비");

      // 렌더링 사이클 이후에 실행되도록 setTimeout 사용
      const immediateTimer = setTimeout(() => {
        console.log("[UseEffect] fetchUserTicketsFromBackend 호출 시작");
        fetchUserTicketsFromBackend();
      }, 0);

      // 30초마다 사용자 티켓 정보 갱신
      const intervalId = setInterval(() => {
        console.log("[Interval] 30초 간격 fetchUserTicketsFromBackend 호출");
        fetchUserTicketsFromBackend();
      }, 30000);

      return () => {
        console.log("[UseEffect] 타이머 정리");
        clearTimeout(immediateTimer);
        clearInterval(intervalId);
      };
    } else {
      console.log(
        "[UseEffect] 조건 불충족으로 fetchUserTicketsFromBackend 호출 안함:",
        {
          isClient,
          hasAccount: !!accountAddress,
          activeRoundId: activeRoundId?.toString(),
        }
      );
    }
  }, [isClient, accountAddress, activeRoundId, fetchUserTicketsFromBackend]);

  // Add handleQuantityChange function right below this
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

  // handleSubmitTickets 함수에서 백엔드 라운드 ID를 직접 사용하도록 수정
  const getActiveRoundIdForTransaction = useCallback(() => {
    // 1. 백엔드의 라운드 ID 사용 (우선)
    if (serverRoundInfo && serverRoundInfo.currentRoundId) {
      return BigInt(serverRoundInfo.currentRoundId);
    }

    // 2. 컨트랙트에서 가져온 라운드 ID 사용 (폴백)
    if (activeRoundId !== undefined) {
      return activeRoundId;
    }

    // 3. 모두 실패한 경우 undefined 반환
    return undefined;
  }, [serverRoundInfo, activeRoundId]);

  // 백엔드에서 가져온 라운드 정보를 기반으로 현재 라운드 ID 설정
  useEffect(() => {
    if (
      serverRoundInfo &&
      serverRoundInfo.currentRoundId &&
      !isLoadingServerInfo
    ) {
      console.log(
        "[RoundID] 백엔드에서 가져온, 현재 활성 라운드 ID:",
        serverRoundInfo.currentRoundId
      );

      // activeRoundId가 undefined이거나 다른 경우에만 refetch 호출
      if (
        activeRoundId === undefined ||
        activeRoundId.toString() !== serverRoundInfo.currentRoundId
      ) {
        console.log(
          "[RoundID] 백엔드 라운드 ID와 다르거나 undefined, 리프레시 시도"
        );
        refetchActiveRound();
      }
    }
  }, [serverRoundInfo, activeRoundId, isLoadingServerInfo, refetchActiveRound]);

  // handleSubmitTickets 함수에서 매개변수 설정 로직 개선
  const handleSubmitTickets = async () => {
    if (!isConnected || !accountAddress) {
      toast.error("지갑을 연결해주세요.");
      return;
    }
    if (!isCorrectNetwork) {
      toast.error(
        `네트워크를 ${
          targetChain?.name || `Chain ID: ${targetChainIdFromEnv}`
        }로 변경해주세요.`
      );
      return;
    }
    if (!lotteryAddress || !urukTokenAddress) {
      toast.error(
        "컨트랙트 주소가 설정되지 않았습니다. 관리자에게 문의하세요."
      );
      return;
    }

    console.log("[구매시작] 티켓 구매 프로세스 시작");

    // 1. 라운드 ID 확인
    const currentRoundId = getActiveRoundIdForTransaction();

    // 라운드 ID 유효성 체크 추가
    if (currentRoundId === undefined) {
      toast.error(
        "현재 라운드 정보를 가져올 수 없습니다. 페이지를 새로고침하세요."
      );
      return;
    }

    console.log("[구매시작] 현재 라운드 ID:", currentRoundId.toString());

    // 2. 수량 확인
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      toast.error("유효한 수량을 입력하세요 (0보다 큰 정수).");
      return;
    }

    console.log("[구매시작] 구매할 티켓 수량:", numQuantity);

    // 3. 토큰 정보 확인
    if (urukDecimals === undefined) {
      toast.error("토큰 정보를 가져오는 중입니다. 잠시 후 다시 시도하세요.");
      return;
    }

    // 상태 초기화
    setApproveArgs(undefined);
    setBuyTicketsArgs(undefined);
    resetApprove();
    resetBuyTickets();
    setCurrentTransactionStep("preparing");

    try {
      // 4. 필요한 토큰 양 계산
      const pricePerTicket = parseUnits("1", urukDecimals);
      const ticketsToBuyBigInt = BigInt(numQuantity);
      const amountNeeded = ticketsToBuyBigInt * pricePerTicket;

      console.log(
        `[구매시작] 티켓당 가격: ${formatUnits(
          pricePerTicket,
          urukDecimals
        )} URUK, 총 필요 금액: ${formatUnits(amountNeeded, urukDecimals)} URUK`
      );

      // 5. 허용량 확인
      const toastId = toast.loading("최신 토큰 허용량 확인 중...");
      const { data: currentAllowance, isError: isRefetchError } =
        await refetchUrukAllowance();

      if (isRefetchError || typeof currentAllowance !== "bigint") {
        toast.error("허용량 확인 실패. 다시 시도하세요.", { id: toastId });
        setCurrentTransactionStep("error");
        return;
      }

      toast.success("허용량 확인 완료!", { id: toastId });
      console.log(
        `[구매시작] 현재 허용량: ${formatUnits(
          currentAllowance,
          urukDecimals
        )} URUK, 필요 금액: ${formatUnits(amountNeeded, urukDecimals)} URUK`
      );

      // 6. 필요한 경우 토큰 승인
      if (currentAllowance < amountNeeded) {
        console.log("[구매시작] 허용량 부족, 승인 필요");
        setCurrentTransactionStep("approving");
        setApproveArgs([lotteryAddress!, maxUint256]);
        return;
      }

      // 7. 승인이 충분한 경우 구매 시작
      console.log(
        `[구매시작] 허용량 충분 (${formatUnits(
          currentAllowance,
          urukDecimals
        )} URUK), 티켓 구매 시작`
      );

      // 중요: 두 개의 매개변수를 설정해야 함 (라운드 ID와 수량)
      const roundIdBigInt = currentRoundId;
      const quantityBigInt = BigInt(numQuantity);

      console.log(
        `[구매시작] buyTickets 매개변수 설정: [${roundIdBigInt.toString()}, ${quantityBigInt.toString()}]`
      );
      setBuyTicketsArgs([roundIdBigInt, quantityBigInt]);

      // 상태 업데이트 전에 약간의 지연
      setTimeout(() => {
        console.log("[구매시작] 티켓 구매 시뮬레이션 단계로 진행");
        setCurrentTransactionStep("startingBuySimulation");
      }, 500);
    } catch (error: any) {
      console.error("[구매시작] 오류 발생:", error);
      toast.error(
        `티켓 구매 준비 중 오류: ${error.message || "알 수 없는 오류"}`
      );
      setCurrentTransactionStep("error");
    }
  };

  // Modify loading message or button disable logic
  let submitButtonText = "Submit";
  if (isClient) {
    if (isTransactionProcessing) {
      if (currentTransactionStep === "approving")
        submitButtonText = "Approving...";
      else if (currentTransactionStep === "buying")
        submitButtonText = "Buying...";
      else if (currentTransactionStep === "startingBuySimulation")
        submitButtonText = "Preparing... (Sim)";
      else if (currentTransactionStep === "preparing")
        submitButtonText = "Preparing...";
      else submitButtonText = "Processing...";
    } else if (currentTransactionStep === "completed") {
      submitButtonText = "Purchase Complete!";
    } else if (currentTransactionStep === "error") {
      submitButtonText = "Error Occurred";
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
    ? `${String(countdown.hours).padStart(2, "0")}:${String(
        countdown.minutes
      ).padStart(2, "0")}:${String(countdown.seconds).padStart(2, "0")}`
    : "--:--:--"; // Display for loading or ended state
  // 로딩 상태는 countdown 값이 아예 없을 때만 표시하여 깜빡임 최소화
  const isCountdownLoading = countdown === null;

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
    console.log("activeRoundId (data):", activeRoundIdData); // Log data directly from useReadContract
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
    activeRoundIdData, // Add activeRoundIdData to dependency array
    activeRoundId,
  ]);

  useEffect(() => {
    console.log("[useEffect setIsClient] Mount effect triggered."); // Log added
    setIsClient(true);
    console.log("[useEffect setIsClient] setIsClient(true) called."); // Log added
  }, []);

  // Ticket purchase transaction simulation and step transition
  useEffect(() => {
    // Check only when loading is finished
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
          "[SimulateEffect] Simulation successful. Transitioning from 'startingBuySimulation' to 'buying'. Request:",
          buyTicketsConfig.request
        );
        setCurrentTransactionStep("buying");
      } else if (
        buyTicketsErrorSimulate &&
        currentTransactionStep === "startingBuySimulation"
      ) {
        // Handle simulation error
        console.error(
          "[SimulateEffect] Simulation failed. Error:",
          buyTicketsErrorSimulate
        );
        const errorMsg =
          (buyTicketsErrorSimulate as any)?.shortMessage ||
          buyTicketsErrorSimulate?.message ||
          "Unknown error";
        toast.error(`Ticket purchase simulation failed: ${errorMsg}`);
        setCurrentTransactionStep("error");
      }
    }
  }, [
    isLoadingBuyTicketsSimulate,
    buyTicketsConfig,
    buyTicketsErrorSimulate,
    currentTransactionStep,
    setCurrentTransactionStep,
  ]);

  // Execute ticket purchase transaction (improved integrated version)
  useEffect(() => {
    // Log state
    console.log(
      "[BuyTransaction] State check - Step:",
      currentTransactionStep,
      "Args:",
      buyTicketsArgs,
      "Request created:",
      !!buyTicketsConfig?.request,
      "Sending:",
      isBuyingTickets,
      "Sent:",
      !!buyTicketsData,
      "Loading:",
      isLoadingBuyTicketsSimulate
    );

    // Condition: Send transaction in 'buying' step
    if (
      currentTransactionStep === "buying" &&
      buyTicketsConfig?.request &&
      buyTicketsArgs &&
      !isBuyingTickets &&
      !buyTicketsData
    ) {
      console.log(
        "[BuyTransaction] Ticket purchase transaction conditions met, sending transaction"
      );

      // Execute transaction
      (async () => {
        const toastId = "buy-tickets-tx";
        try {
          toast.loading("Sending ticket purchase transaction...", {
            id: toastId,
          });

          // Send transaction
          await buyTicketsAsync(buyTicketsConfig.request);

          console.log("[BuyTransaction] Transaction sent successfully");
          // Transaction confirmation is handled in isSuccessBuyTickets useEffect
        } catch (error) {
          console.error("[BuyTransaction] Transaction sending failed:", error);
          const errorMsg =
            (error as any)?.shortMessage ||
            (error as Error)?.message ||
            "Unknown error";
          toast.error(`Ticket purchase failed: ${errorMsg}`, { id: toastId });

          // Reset state on error
          setCurrentTransactionStep("error");
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
  ]);

  // 서버에서 라운드 정보를 가져오는 함수 개선 - 임시 데이터 제거
  const fetchServerRoundInfo = useCallback(async () => {
    try {
      console.log("[Server] 서버에서 라운드 정보 가져오기 시작");

      // 실제 백엔드 API 호출 시도
      let serverData = null;

      try {
        // 서버 API 엔드포인트 - 실제 구현 시 정확한 URL로 변경 필요
        const serverUrl = "/api/status";
        console.log("[Server] 백엔드 API 호출 시도:", serverUrl);

        const response = await fetch(serverUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
          cache: "no-store",
          next: { revalidate: 0 },
        }).catch((error) => {
          console.error("[Server] 백엔드 API 통신 실패:", error);
          throw new Error("백엔드 서버 연결 실패");
        });

        if (!response.ok) {
          console.error(
            "[Server] 백엔드 응답 오류:",
            response.status,
            response.statusText
          );
          throw new Error(`백엔드 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.roundInfo) {
          serverData = data.roundInfo;
          console.log("[Server] 백엔드에서 라운드 정보 정상 수신:", serverData);
        } else {
          console.error("[Server] 백엔드 데이터 형식 오류:", data);
          throw new Error("백엔드 데이터 형식 오류");
        }

        // 백엔드 데이터 성공적으로 받았을 때만 상태 업데이트
        setServerRoundInfo(serverData);
        setTimeOffset(0); // 필요에 따라 서버와 클라이언트 시간 차이 계산 로직 추가 가능
        setIsLoadingServerInfo(false);

        console.log("[Server] 백엔드 라운드 정보 설정 완료:", serverData);
        console.log(
          "[Server] 백엔드 종료 시간:",
          new Date(serverData.roundEndTimestamp * 1000).toLocaleString()
        );

        return serverData;
      } catch (error) {
        console.error("[Server] 백엔드 데이터를 가져올 수 없습니다:", error);
        // 백엔드 연결 실패 시 서버 정보를 null로 설정
        setServerRoundInfo(null);
        setIsLoadingServerInfo(false);
        return null;
      }
    } catch (error) {
      console.error("[Server] 라운드 정보 가져오기 최종 오류:", error);
      setIsLoadingServerInfo(false);
      return null;
    }
  }, [activeRoundId]);

  // 카운트다운 로직에서 컨트랙트 데이터 또는 백엔드 데이터만 사용
  useEffect(() => {
    // 카운트다운 계산 함수 추가
    const calculateCountdown = () => {
      // 서버 라운드 정보 또는 컨트랙트 데이터를 사용
      let endTimeToUse = null;
      let dataSource = "";

      // 1. 컨트랙트에서 가져온 roundEndTime 사용 시도
      if (roundEndTime) {
        endTimeToUse = roundEndTime;
        dataSource = "컨트랙트";
        console.log(
          "[Countdown] 컨트랙트 종료 시간 사용:",
          new Date(endTimeToUse * 1000).toLocaleString()
        );
      }
      // 2. 백엔드 서버에서 가져온 시간 사용 시도
      else if (serverRoundInfo && serverRoundInfo.roundEndTimestamp) {
        endTimeToUse = serverRoundInfo.roundEndTimestamp;
        dataSource = "백엔드";
        console.log(
          `[Countdown] ${dataSource} 종료 시간 사용:`,
          new Date(endTimeToUse * 1000).toLocaleString()
        );
      }

      if (!endTimeToUse) {
        // 종료 시간 정보를 찾지 못한 경우 이전 카운트다운을 그대로 유지하여 화면 깜빡임 방지
        console.log(
          "[Countdown] 종료 시간 정보가 없습니다. 기존 카운트다운 유지"
        );
        return;
      }

      // 서버 시간과 로컬 시간의 차이 고려 (timeOffset은 초 단위)
      const now = Math.floor(Date.now() / 1000) + timeOffset;
      const timeLeft = endTimeToUse - now;

      console.log(
        "[Countdown] 현재 시간:",
        new Date(now * 1000).toLocaleString()
      );
      console.log(
        `[Countdown] ${dataSource} 종료 시간:`,
        new Date(endTimeToUse * 1000).toLocaleString()
      );
      console.log("[Countdown] 남은 시간(초):", timeLeft);

      if (timeLeft <= 0) {
        // 타이머가 종료된 경우
        setCountdown(null);
        console.log("[Countdown] 라운드 종료됨");
        return;
      }

      // 시간, 분, 초 계산
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = Math.floor(timeLeft % 60);

      setCountdown({ hours, minutes, seconds });
    };

    // 초기 계산
    calculateCountdown();

    // 1초마다 업데이트
    const timer = setInterval(calculateCountdown, 1000);

    return () => clearInterval(timer);
  }, [roundEndTime, serverRoundInfo, timeOffset]);

  // 컴포넌트 마운트 시 서버 정보 가져오기 - hydration 이슈 방지
  useEffect(() => {
    if (isClient) {
      console.log("[Mount] 서버 정보 가져오기 시작");

      // 렌더링 사이클 이후 실행하여 hydration 오류 방지
      const timer = setTimeout(() => {
        // 페이지 로드 시 즉시 서버 정보 가져오기
        fetchServerRoundInfo().then((info) => {
          if (info) {
            console.log("[Mount] 서버 정보 가져오기 성공:", info);

            // 카운트다운 계산 시작을 위한 상태 설정
            const now = Math.floor(Date.now() / 1000);
            if (info.roundEndTimestamp > now) {
              const timeLeft = info.roundEndTimestamp - now;
              const hours = Math.floor(timeLeft / 3600);
              const minutes = Math.floor((timeLeft % 3600) / 60);
              const seconds = Math.floor(timeLeft % 60);

              setCountdown({ hours, minutes, seconds });
              console.log(
                `[Mount] 카운트다운 설정: ${hours}시간 ${minutes}분 ${seconds}초`
              );
            } else {
              console.log("[Mount] 라운드가 이미 종료됨");
            }
          }
        });
      }, 0); // 0ms 지연으로 렌더링 사이클 이후 실행

      return () => clearTimeout(timer);
    }
  }, [isClient, fetchServerRoundInfo]);

  // -----------------------------
  // 1) 서버 상태(라운드 정보) 폴링 (3초 간격)
  // -----------------------------
  useEffect(() => {
    if (!isClient) return;

    // 최초 1회 즉시 호출
    fetchServerRoundInfo();

    // 3초마다 /api/status 폴링
    const statusInterval = setInterval(() => {
      fetchServerRoundInfo();
    }, 3000);

    return () => clearInterval(statusInterval);
  }, [isClient, fetchServerRoundInfo]);

  // -----------------------------
  // 2) 리더보드 폴링 주기 5초로 단축
  // -----------------------------
  useEffect(() => {
    if (isClient && accountAddress && activeRoundId) {
      // 1회 즉시 호출은 기존 immediateTimer 로직 활용
      const intervalId = setInterval(() => {
        console.log("[Leaderboard] 5초 간격 fetchUserTicketsFromBackend 호출");
        fetchUserTicketsFromBackend();
      }, 5000); // 5초 간격

      return () => clearInterval(intervalId);
    }
  }, [isClient, accountAddress, activeRoundId, fetchUserTicketsFromBackend]);

  // -----------------------
  // Approve Transaction Send
  // -----------------------
  useEffect(() => {
    if (
      currentTransactionStep === "approving" &&
      approveArgs &&
      approveConfig?.request &&
      !isApproving &&
      !approveData
    ) {
      console.log("[Approve] 조건 충족, approve 트랜잭션 전송");

      (async () => {
        const toastId = "approve-tx";
        try {
          toast.loading("토큰 사용 허용 트랜잭션 전송 중...", { id: toastId });
          await approveAsync(approveConfig.request);
          console.log("[Approve] 트랜잭션 전송 성공");
        } catch (error) {
          console.error("[Approve] 트랜잭션 전송 실패:", error);
          toast.error(
            "토큰 승인 실패: " +
              ((error as any)?.shortMessage ||
                (error as Error)?.message ||
                "Unknown"),
            {
              id: toastId,
            }
          );
          setCurrentTransactionStep("error");
        }
      })();
    }
  }, [
    currentTransactionStep,
    approveArgs,
    approveConfig,
    approveAsync,
    isApproving,
    approveData,
  ]);

  // -----------------------
  // Approve Success 후 처리
  // -----------------------
  useEffect(() => {
    if (isSuccessApprove) {
      console.log("[Approve] 승인 완료, 티켓 구매 로직으로 이동");
      toast.success("토큰 사용 허용 완료! 이제 티켓을 구매합니다.");

      // 기존 상태 초기화 후 구매 로직 재호출
      // setCurrentTransactionStep("preparing"); // 이 부분은 handleSubmitTickets에서 처리

      // handleSubmitTickets 재실행하여 buyTickets 진행
      // 주의: quantity 상태가 여기서 사용되지 않도록 handleSubmitTickets 내부 로직을 잘 확인해야 함
      // 또는, approve 직후에는 quantity를 다시 입력받도록 유도할 수도 있음
      // 현재는 approve 후 바로 이어서 구매 시도
      setTimeout(() => {
        // approve 완료 후 handleSubmitTickets를 직접 호출할 때,
        // quantity가 이전 값으로 남아있으면 안되므로, 여기서 quantity를 비우거나,
        // handleSubmitTickets가 quantity를 직접 참조하지 않도록 해야 함.
        // 가장 간단한 방법은 approve 후 사용자가 다시 제출 버튼을 누르도록 유도하는 것.
        // 여기서는 일단 자동으로 이어가도록 두되, 이 부분을 인지.
        handleSubmitTickets();
      }, 300);
    }
  }, [isSuccessApprove /* 의존성에 handleSubmitTickets 추가 고려 */]);

  // 마운트 및 의존성 변경 시 컨트랙트에서 보유 티켓 즉시 조회
  useEffect(() => {
    if (isClient && accountAddress && activeRoundId) {
      console.log("[OwnedTickets] 초기 refetchOwnedTickets 호출");
      refetchOwnedTickets();
    }
  }, [isClient, accountAddress, activeRoundId, refetchOwnedTickets]);

  // 캐시된 티켓 수 (새로고침 시 깜빡임 방지)
  const [cachedTickets, setCachedTickets] = useState<bigint | null>(null);

  // 로컬스토리지 키 헬퍼
  const getTicketCacheKey = (addr: string, round: bigint) =>
    `tickets_${addr.toLowerCase()}_${round.toString()}`;

  // 초기 캐시 불러오기
  useEffect(() => {
    if (isClient && accountAddress && activeRoundId !== undefined) {
      const key = getTicketCacheKey(accountAddress, activeRoundId);
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          setCachedTickets(BigInt(cached));
          console.log("[Cache] 로컬 캐시 티켓 수 로드:", cached);
        } catch {}
      }
    }
  }, [isClient, accountAddress, activeRoundId]);

  // ownedTickets 변경 시 캐시 저장
  useEffect(() => {
    if (
      isClient &&
      accountAddress &&
      activeRoundId !== undefined &&
      ownedTickets !== undefined
    ) {
      const key = getTicketCacheKey(accountAddress, activeRoundId);
      localStorage.setItem(key, ownedTickets.toString());
      setCachedTickets(ownedTickets);
      console.log("[Cache] 티켓 수 캐시 저장:", ownedTickets.toString());
    }
  }, [ownedTickets, isClient, accountAddress, activeRoundId]);

  // pendingTicketCount 확정 시 캐시 업데이트
  useEffect(() => {
    if (
      isClient &&
      accountAddress &&
      activeRoundId !== undefined &&
      pendingTicketCount !== null
    ) {
      const key = getTicketCacheKey(accountAddress, activeRoundId);
      localStorage.setItem(key, pendingTicketCount.toString());
      setCachedTickets(pendingTicketCount);
    }
  }, [pendingTicketCount, isClient, accountAddress, activeRoundId]);

  return (
    <PageLayout>
      {/* Main Content Section */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-7 gap-4 mb-12">
        {/* GIF Container - changed to md:col-span-2, items-start justify-center */}
        <div className="md:col-span-2 flex flex-col items-start justify-center">
          <div className="relative w-96 h-96">
            {" "}
            {/* Maintain GIF image size */}
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

        {/* Spacer for middle section - changed from md:col-span-3 to md:col-span-2 */}
        <div className="hidden md:block md:col-span-2"></div>

        {/* Right Column Data (Countdown + Leaderboard) - changed from md:col-span-2 to md:col-span-3 */}
        <div className="md:col-span-3 flex flex-col items-center gap-4">
          {/* UPDATED: Countdown Box - Total prize display modified */}
          <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 flex flex-col items-center justify-center shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow w-full flex-1">
            <h3 className="text-base font-medium text-purple-200 mb-1 font-joystix">
              countdown
            </h3>
            <div className="text-3xl font-bold text-white flex items-center mb-3 font-joystix">
              {isCountdownLoading ? (
                <span className="animate-pulse">--:--:--</span>
              ) : (
                <>
                  <span>{String(countdown?.hours ?? 0).padStart(2, "0")}</span>
                  <span className="mx-1 animate-pulse">:</span>
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
            <div className="text-center">
              <span className="text-xs text-purple-200 font-joystix">
                Total Prize :{" "}
              </span>
              {isClient &&
              !isLoadingLotteryPoolBalance &&
              urukDecimals !== undefined ? (
                <span className="text-xs font-medium text-pink-400 font-joystix">
                  {parseFloat(displayedPoolBalance).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits:
                      Number(displayedPoolBalance.split(".")[1]?.length || 0) >
                      3
                        ? 2
                        : 0,
                  })}{" "}
                  $URUK
                </span>
              ) : (
                <span className="text-xs font-medium text-pink-400 animate-pulse">
                  Loading...
                </span>
              )}
            </div>
          </div>

          {/* UPDATED: Leaderboard Box */}
          <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow w-full flex-1">
            <h3 className="text-base font-medium text-purple-200 mb-3 text-center font-joystix">
              Leaderboard (Round {activeRoundId?.toString() ?? "..."})
            </h3>
            <div className="space-y-2 min-h-[200px]">
              {/* Minimum height added */}
              {isLoadingLeaderboard ? (
                <div className="flex justify-center items-center h-full">
                  <p className="text-xs text-purple-300 animate-pulse">
                    Loading leaderboard...
                  </p>
                </div>
              ) : leaderboardError ? (
                <div className="flex justify-center items-center h-full">
                  <p className="text-xs text-red-400">{leaderboardError}</p>
                </div>
              ) : leaderboardData.length > 0 ? (
                leaderboardData.map((entry, index) => (
                  <div
                    key={entry.address || index}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="w-5 text-right mr-2">
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
                  <p className="text-xs text-gray-400">
                    No leaderboard data available for this round.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
        <a
          href="https://www.kuru.io/trade/0x5d6506e92b0a1205bd717b66642e961edad0a884"
          target="_blank"
          rel="noopener noreferrer"
          className="md:col-span-2"
        >
          <button className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-pink-600/30 text-sm font-joystix">
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
          className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-joystix"
          disabled={isSubmitButtonDisabled}
        >
          {submitButtonText}
        </button>
      </div>

      {/* Owned Tickets Display Section */}
      <div className="max-w-4xl mx-auto w-full mb-8">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* URUK balance display (moved from header.tsx) */}
          <div className="bg-black/30 px-4 py-2 rounded-md border border-purple-500/30">
            <p className="text-base font-medium text-purple-200">
              My Balance:{" "}
              {!isClient ||
              isLoadingUrukBalance ||
              urukDecimals === undefined ? (
                <span className="text-lg font-bold text-white animate-pulse">
                  Loading...
                </span>
              ) : (
                <span className="text-lg font-bold text-white font-joystix">
                  {Math.floor(
                    parseFloat(urukBalanceFormatted)
                  ).toLocaleString()}{" "}
                  $URUK
                </span>
              )}
            </p>
          </div>

          {/* Ticket ownership display (existing part) */}
          <div className="bg-black/30 px-4 py-2 rounded-md border border-purple-500/30">
            <p className="text-base font-medium text-purple-200">
              My Ticket:{" "}
              {!isClient || !accountAddress ? (
                <span className="text-lg font-bold text-white animate-pulse">
                  --
                </span>
              ) : pendingTicketCount !== null ? (
                <span className="text-lg font-bold text-white font-joystix">
                  {Math.floor(Number(pendingTicketCount))}
                </span>
              ) : isLoadingOwnedTickets && cachedTickets === null ? (
                <span className="text-lg font-bold text-white animate-pulse">
                  --
                </span>
              ) : ownedTickets !== undefined ? (
                <span className="text-lg font-bold text-white font-joystix">
                  {Math.floor(Number(ownedTickets))}
                </span>
              ) : cachedTickets !== null ? (
                <span className="text-lg font-bold text-white font-joystix opacity-70">
                  {Math.floor(Number(cachedTickets))}
                </span>
              ) : (
                <span className="text-lg font-bold text-white animate-pulse">
                  --
                </span>
              )}{" "}
              🎟️
            </p>
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="max-w-4xl mx-auto w-full mb-12">
        <h3 className="text-sm text-yellow-500 font-bold mb-4 text-center font-joystix">
          !!! You must withdraw $URUK to your EVM wallet to buy tickets. !!!
        </h3>
        <h2 className="text-lg font-bold mb-4 text-center font-joystix">
          URUK URUK Wanna get a gift from the cutest cat ever? Grab a ticket
          with $URUK and take your shot at winning!
        </h2>
        <ul className="space-y-2 mb-8">
          {[
            "1 $URUK = 1 ticket.",
            "All  spent on tickets goes into the prize pool.",
            "One lucky winner gets the entire pool of $URUK.",
            "A winner is picked every 6 hours, and the prize gets airdropped straight to their wallet!",
          ].map((text, index) => (
            <li key={index} className="flex items-start">
              <span className="inline-block w-4 h-4 mr-2 rounded-full border border-pink-500 flex-shrink-0"></span>
              <span className="text-sm text-purple-200">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </PageLayout>
  );
}

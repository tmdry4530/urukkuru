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
      enabled: !!lotteryAddress && isConnected && isCorrectNetwork && isClient,
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
    args: activeRoundId !== undefined ? [activeRoundId] : undefined, // This query may auto-refresh if activeRoundId changes
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!lotteryAddress &&
        activeRoundId !== undefined && // Should be called only if activeRoundId exists
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60 * 60 * 6, // 6 hours
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
        isConnected &&
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60,
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

  // isTransactionProcessing 상태를 useMemo로 변경
  const isTransactionProcessing = useMemo(
    () =>
      isApproving ||
      isConfirmingApprove ||
      isBuyingTickets ||
      isConfirmingBuyTickets,
    [isApproving, isConfirmingApprove, isBuyingTickets, isConfirmingBuyTickets]
  );

  // Added useEffect to refresh data after successful transaction
  useEffect(() => {
    if (isSuccessBuyTickets) {
      console.log(
        "[TransactionSuccess] Ticket purchase transaction successful, starting data refresh"
      );

      // Notify success with a toast message
      toast.success("Ticket purchase complete! Refreshing data...");

      // Change state
      setCurrentTransactionStep("completed");

      // Refresh data after a short delay (considering blockchain state reflection time)
      setTimeout(async () => {
        try {
          // Refresh owned ticket quantity
          const ticketsResult = await refetchOwnedTickets();
          console.log(
            "[DataRefresh] Ticket quantity refresh result:",
            ticketsResult
          );

          // Refresh lottery pool balance (total prize)
          const poolResult = await refetchLotteryPoolBalance();
          console.log(
            "[DataRefresh] Lottery pool balance refresh result:",
            poolResult
          );

          // Refresh URUK token balance
          await refetchUrukBalance();

          // Refresh URUK token allowance
          await refetchUrukAllowance();

          toast.success("Data refresh complete!");
        } catch (error) {
          console.error("[DataRefresh] Error during data refresh:", error);
          toast.error(
            "Failed to refresh some data. Please try refreshing the page."
          );
        }
      }, 2000); // 2-second delay
    }
  }, [
    isSuccessBuyTickets,
    refetchOwnedTickets,
    refetchLotteryPoolBalance,
    refetchUrukBalance,
    refetchUrukAllowance,
  ]);

  // 허용량(approve) 트랜잭션 완료 후 티켓 구매로 진행하는 useEffect 추가
  useEffect(() => {
    if (isSuccessApprove && currentTransactionStep === "approving") {
      console.log(
        "[ApproveSuccess] Token approval successful, proceeding to ticket purchase"
      );

      // 허용량 승인 성공 토스트 메시지
      toast.success("Token approval successful! Proceeding to purchase...");

      // 원래 handleSubmitTickets에서 입력된 quantity 가져오기
      const numQuantity = parseInt(quantity, 10);
      if (
        isNaN(numQuantity) ||
        numQuantity <= 0 ||
        urukDecimals === undefined
      ) {
        console.error("[ApproveSuccess] Invalid quantity or missing decimals");
        setCurrentTransactionStep("error");
        return;
      }

      // 티켓 구매 인자 설정
      const ticketsToBuyBigInt = BigInt(numQuantity);
      setBuyTicketsArgs([ticketsToBuyBigInt]);

      // 상태 업데이트 - 시뮬레이션 시작 단계로 전환
      setTimeout(() => {
        console.log(
          "[ApproveSuccess] Setting transaction step to startingBuySimulation"
        );
        setCurrentTransactionStep("startingBuySimulation");
      }, 500);
    }
  }, [isSuccessApprove, currentTransactionStep, quantity, urukDecimals]);

  // 허용량 승인(approve) 트랜잭션 실행 추가
  useEffect(() => {
    // 상태 로그
    console.log(
      "[ApproveTransaction] Status check - Step:",
      currentTransactionStep,
      "Args:",
      approveArgs,
      "Config:",
      !!approveConfig?.request,
      "Approving:",
      isApproving,
      "Approved:",
      !!approveData
    );

    // 조건: 'approving' 상태일 때 트랜잭션 전송
    if (
      currentTransactionStep === "approving" &&
      approveConfig?.request &&
      approveArgs &&
      !isApproving &&
      !approveData
    ) {
      console.log(
        "[ApproveTransaction] Token approval conditions met, sending transaction"
      );

      // 트랜잭션 실행
      (async () => {
        const toastId = "approve-token-tx";
        try {
          toast.loading("Sending token approval transaction...", {
            id: toastId,
          });

          // 트랜잭션 전송
          await approveAsync(approveConfig.request);

          console.log(
            "[ApproveTransaction] Approval transaction sent successfully"
          );
          // 트랜잭션 확인은 isSuccessApprove useEffect에서 처리
        } catch (error) {
          console.error("[ApproveTransaction] Approval sending failed:", error);
          const errorMsg =
            (error as any)?.shortMessage ||
            (error as Error)?.message ||
            "Unknown error";
          toast.error(`Token approval failed: ${errorMsg}`, { id: toastId });

          // 오류 발생 시 상태 초기화
          setCurrentTransactionStep("error");
        }
      })();
    }
  }, [
    approveConfig,
    approveAsync,
    approveArgs,
    currentTransactionStep,
    isApproving,
    approveData,
  ]);

  // Animate glow effect (existing logic maintained)
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowIntensity((prev) => {
        const newValue = prev + 0.05 * (Math.random() > 0.5 ? 1 : -1);
        return Math.max(0.8, Math.min(1.2, newValue));
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Function to get server time
  const fetchServerTime = useCallback(async () => {
    try {
      // Request backend server time via Next.js API path
      const response = await fetch("/api/server-time", {
        cache: "no-store", // Always latest data
        headers: { "Cache-Control": "no-cache" },
      });

      if (!response.ok) {
        throw new Error("Failed to get server time");
      }
      const data = await response.json();

      // Check time source (backend or Next.js fallback)
      const timeSource =
        data.source === "next-fallback" ? "Next.js Fallback" : "Backend Server";

      // Calculate difference between server time and local time (in seconds)
      const localTime = Math.floor(Date.now() / 1000);
      const serverTime = data.timestamp;
      const offset = serverTime - localTime;

      console.log(
        `[ServerTime] ${timeSource} Time: ${serverTime}, Local Time: ${localTime}, Offset: ${offset}s`
      );

      // Display warning if backend connection failed (optional)
      if (data.source === "next-fallback") {
        console.warn(
          "[ServerTime] Could not connect to backend server, using Next.js server time."
        );
      }

      setTimeOffset(offset);

      return { serverTime, offset, source: timeSource };
    } catch (error) {
      console.error("[ServerTime] Error fetching server time:", error);
      // Set offset to 0 to use local time on error
      return {
        serverTime: Math.floor(Date.now() / 1000),
        offset: 0,
        source: "Local Time (Error)",
      };
    }
  }, []);

  // Synchronize server time on component mount
  useEffect(() => {
    if (isClient) {
      console.log("[ServerTime] Initial server time synchronization started");
      // Get server time on initial load
      fetchServerTime();

      // Re-synchronize server time every 2 minutes (changed from 1 minute)
      const syncInterval = setInterval(() => {
        console.log(
          "[ServerTime] Regular server time synchronization executed"
        );
        fetchServerTime();
      }, 120000); // Increased to 2 minutes

      return () => clearInterval(syncInterval);
    }
  }, [isClient, fetchServerTime]);

  // UPDATED: Countdown timer - server time based
  const calculateCountdown = useCallback(() => {
    if (roundEndTime === null || roundEndTime === undefined) {
      // 기존 상태와 비교하여 변경될 때만 업데이트
      if (countdown !== null) {
        setCountdown(null);
      }
      return true; // Indicate timer should stop if no end time
    }

    // Calculate current time with offset (server time based)
    const now = Math.floor(Date.now() / 1000) + timeOffset;
    const remainingSeconds = roundEndTime - now;

    // Conditional debug log (every 10 seconds or last 5 seconds)
    if (remainingSeconds % 10 === 0 || remainingSeconds <= 5) {
      console.log(
        `[Countdown] Current round end time: ${roundEndTime}, Current time (server based): ${now}, Remaining: ${remainingSeconds}s`
      );
    }

    if (remainingSeconds <= 0) {
      // 기존 상태와 비교하여 변경될 때만 업데이트
      if (
        countdown === null ||
        countdown.hours !== 0 ||
        countdown.minutes !== 0 ||
        countdown.seconds !== 0
      ) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      }
      return true;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;

      // 기존 상태와 비교하여 변경될 때만 업데이트
      if (
        countdown === null ||
        countdown.hours !== hours ||
        countdown.minutes !== minutes ||
        countdown.seconds !== seconds
      ) {
        setCountdown({ hours, minutes, seconds });
      }
      return false;
    }
  }, [roundEndTime, timeOffset, countdown]);

  const isProcessingNewRound = useRef(false); // useRef to prevent duplicate processing flag
  const queryClient = useQueryClient(); // Query Client instance

  // 백엔드 연결 실패 시 계약에서 직접 정보를 가져오는 폴백 함수
  const fallbackToContractData = useCallback(async () => {
    console.warn(
      "[BackendRound] Attempting fallback: Getting data directly from contract or using static values."
    );
    let endTimeSet = false;

    if (activeRoundId !== undefined && roundEndTimeData !== undefined) {
      try {
        const endTime = Number(roundEndTimeData);
        setRoundEndTime(endTime);
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = Math.max(0, endTime - now); // Ensure non-negative
        setServerRoundInfo({
          currentRoundId: activeRoundId.toString(),
          nextDrawTime: endTime,
          timeRemaining: timeRemaining,
          roundEndTimestamp: endTime,
        });
        endTimeSet = true;
        console.log(
          `[BackendRound] Fallback data set from contract - Round: ${activeRoundId.toString()}, End time: ${new Date(
            endTime * 1000
          ).toISOString()}, Remaining: ${timeRemaining}s`
        );
      } catch (error) {
        console.error(
          "[BackendRound] Error setting fallback data from contract:",
          error
        );
      }
    }

    if (!endTimeSet) {
      console.warn(
        "[BackendRound] Contract data for fallback unavailable or failed. Using static fallback end time (6 hours from now)."
      );
      const now = Math.floor(Date.now() / 1000);
      const staticEndTime = now + 6 * 60 * 60; // 6 hours
      setRoundEndTime(staticEndTime);
      setServerRoundInfo({
        currentRoundId: activeRoundId?.toString() ?? "static-fallback",
        nextDrawTime: staticEndTime,
        timeRemaining: 6 * 60 * 60,
        roundEndTimestamp: staticEndTime,
      });
      // 사용자에게 상황을 알리는 토스트 메시지를 표시할 수 있습니다.
      // toast.error("Failed to get complete round details. Displaying estimated time.", { duration: 5000 });
    }
  }, [activeRoundId, roundEndTimeData]); // setState 함수들 제거

  // 라운드 정보 fetch 함수 (의존성 배열 최적화)
  const fetchRoundInfoFromBackend = useCallback(async () => {
    // 클라이언트 측에서만 실행
    if (!isClient) {
      console.log("[BackendRound] Client not ready, skipping fetch");
      return;
    }

    try {
      setIsLoadingServerInfo(true);
      const response = await fetch("/api/status", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        // 타임아웃 설정을 위한 AbortController
        signal: AbortSignal.timeout(3000), // 3초 타임아웃
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch round info from backend: ${response.status}`
        );
      }

      const data = (await response.json()) as ServerStatus;
      console.log("[BackendRound] Received round info:", data);

      if (data.success && data.roundInfo) {
        // 서버에서 제공하는 라운드 정보 저장
        setServerRoundInfo(data.roundInfo);

        // 서버 시간과 로컬 시간의 차이 계산 (시간 동기화)
        const localTime = Math.floor(Date.now() / 1000);
        const serverTime = data.serverTime.timestamp;
        const offset = serverTime - localTime;
        setTimeOffset(offset);

        // 라운드 종료 시간 설정 (백엔드 기준)
        setRoundEndTime(data.roundInfo.roundEndTimestamp);

        console.log(
          `[BackendRound] Current round: ${
            data.roundInfo.currentRoundId
          }, End time: ${new Date(
            data.roundInfo.roundEndTimestamp * 1000
          ).toISOString()}`
        );
        console.log(
          `[BackendRound] Time remaining: ${data.roundInfo.timeRemaining} seconds`
        );
      } else {
        console.error("[BackendRound] Invalid response from backend:", data);
        // 폴백: 계약에서 직접 정보 가져오기
        await fallbackToContractData();
      }
    } catch (error) {
      console.error("[BackendRound] Error fetching round info:", error);

      // 폴백: 계약에서 직접 정보 가져오기
      await fallbackToContractData();
    } finally {
      setIsLoadingServerInfo(false);
    }
  }, [isClient, fallbackToContractData]); // setTimeOffset 제거

  // useEffect에서만 isClient를 사용하는 대신,
  // fetchRoundInfoFromBackend 함수 자체에서 isClient를 체크하도록 변경했으므로
  // 추가적인 isClient 체크가 필요 없습니다.
  useEffect(() => {
    if (!isClient) {
      console.log("[useEffect setIsClient] Mount effect triggered."); // Log added
      setIsClient(true);
      console.log("[useEffect setIsClient] setIsClient(true) called."); // Log added
      return;
    }

    // 컴포넌트 마운트 시에만 실행되도록 setTimeout 사용
    const timer = setTimeout(() => {
      // 초기 데이터 로딩
      fetchRoundInfoFromBackend();
    }, 100);

    return () => clearTimeout(timer);
  }, [isClient, fetchRoundInfoFromBackend]);

  // 컴포넌트 마운트 후 주기적으로 라운드 정보 가져오기
  useEffect(() => {
    if (!isClient) return;

    // 1분마다 새로고침
    const interval = setInterval(() => {
      fetchRoundInfoFromBackend();
    }, 60000); // 60초마다

    return () => clearInterval(interval);
  }, [isClient, fetchRoundInfoFromBackend]);

  // 카운트다운이 0이 되면 즉시 백엔드에서 새 라운드 정보 가져오기
  useEffect(() => {
    if (!isClient) return;

    if (
      countdown?.hours === 0 &&
      countdown?.minutes === 0 &&
      countdown?.seconds <= 5
    ) {
      // 5초 이하로 남으면 더 자주 서버에 확인
      const checkInterval = setInterval(() => {
        console.log(
          "[Countdown] Less than 5 seconds remaining, checking for new round..."
        );
        fetchRoundInfoFromBackend();
      }, 1000); // 1초마다

      return () => clearInterval(checkInterval);
    }
  }, [isClient, countdown, fetchRoundInfoFromBackend]);

  // 카운트다운 계산 및 라운드 갱신 로직
  useEffect(() => {
    if (!isClient) return;

    // 이미 처리 중인 경우 새 타이머 시작하지 않음
    if (isProcessingNewRound.current) return;

    let isMounted = true; // 컴포넌트가 마운트된 상태인지 추적
    let timerId: NodeJS.Timeout | null = null;

    // 카운트다운이 0인 경우 새 라운드 데이터 가져오기
    const handleZeroCountdown = async () => {
      if (!isMounted || isProcessingNewRound.current) return;

      isProcessingNewRound.current = true;
      console.log(
        "[Countdown] Countdown ended. Starting new round data refresh."
      );

      try {
        await fetchRoundInfoFromBackend();

        if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단

        if (
          serverRoundInfo &&
          serverRoundInfo.currentRoundId !== lastProcessedRoundId
        ) {
          console.log(
            `[Countdown] New round #${serverRoundInfo.currentRoundId} detected! Previous round: #${lastProcessedRoundId}`
          );

          if (isMounted) {
            setLastProcessedRoundId(serverRoundInfo.currentRoundId);
            setShowingNewRoundAlert(false);
          }

          // 컨트랙트 데이터 갱신
          await Promise.all([
            refetchOwnedTickets(),
            refetchLotteryPoolBalance(),
            refetchUrukBalance(),
            refetchUrukAllowance(),
          ]);

          if (isMounted) {
            toast.success(
              `New round #${serverRoundInfo.currentRoundId} has started!`
            );
          }
        } else {
          console.log("[Countdown] Round ID has not changed yet. Waiting...");

          if (isMounted) {
            setShowingNewRoundAlert(false);
          }
        }
      } catch (error) {
        console.error("[Countdown] Error refreshing new round data:", error);
        if (isMounted) {
          toast.error("Failed to fetch next round information.");
          setShowingNewRoundAlert(false);
        }
      } finally {
        // 5초 후 플래그 해제
        setTimeout(() => {
          if (isMounted) {
            isProcessingNewRound.current = false;
            console.log("[Countdown] New round processing flag released.");
          }
        }, 5000);
      }
    };

    // 카운트다운 업데이트 함수
    const updateCountdown = () => {
      if (!isMounted) return;

      const stopped = calculateCountdown();

      // 카운트다운이 0이면 새 라운드 데이터 가져오기
      if (
        stopped &&
        countdown?.hours === 0 &&
        countdown?.minutes === 0 &&
        countdown?.seconds === 0
      ) {
        handleZeroCountdown();
        return;
      }

      // 타이머 계속 실행
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(updateCountdown, 1000);
    };

    // 초기 업데이트 실행
    updateCountdown();

    // 클린업 함수
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [
    isClient,
    calculateCountdown,
    countdown,
    fetchRoundInfoFromBackend,
    serverRoundInfo,
    lastProcessedRoundId,
    refetchOwnedTickets,
    refetchLotteryPoolBalance,
    refetchUrukBalance,
    refetchUrukAllowance,
  ]);

  // Fetch Leaderboard Data (fetch participant info directly from contract)
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

          // Create a map to track each address's ticket count
          const ticketsMap = new Map<string, bigint>();

          // Initialize public client for event logs
          const publicClient = await waitForClient();
          if (!publicClient) {
            throw new Error("Failed to initialize public client");
          }

          // 현재 라운드의 티켓 구매 이벤트 가져오기
          try {
            console.log("[Leaderboard] Querying for TicketPurchased events...");

            const events = await publicClient.getContractEvents({
              address: lotteryAddress,
              abi: UrukLotteryABI,
              eventName: "TicketPurchased",
              fromBlock: BigInt(0), // 시작 블록
              toBlock: "latest",
              args: {
                rid: activeRoundId, // 현재 라운드 ID 필터링
              },
              strict: true,
            });

            console.log(
              `[Leaderboard] Found ${events.length} ticket purchase events`
            );

            // 각 이벤트를 처리하여 주소별 티켓 합계 계산
            events.forEach((event) => {
              if (event.args && typeof event.args === "object") {
                const args = event.args as any;
                if (args.player && args.tickets) {
                  const player = args.player as string;
                  const tickets = args.tickets as bigint;

                  // 기존 티켓 수에 추가
                  const currentTickets = ticketsMap.get(player) || BigInt(0);
                  ticketsMap.set(player, currentTickets + tickets);

                  console.log(
                    `[Leaderboard] Player ${player} has ${
                      currentTickets + tickets
                    } tickets`
                  );
                }
              }
            });

            console.log(
              `[Leaderboard] Processed ${ticketsMap.size} unique players`
            );
          } catch (eventError) {
            console.error("[Leaderboard] Error fetching events:", eventError);

            // 이벤트 쿼리에 실패한 경우에도 현재 사용자의 티켓은 표시
            console.log(
              "[Leaderboard] Falling back to current user's tickets only"
            );

            // 현재 사용자 티켓만 표시
            if (accountAddress && ownedTickets && ownedTickets > BigInt(0)) {
              ticketsMap.set(accountAddress, ownedTickets);
            }
          }

          // 현재 사용자의 티켓 정보가 정확한지 확인하고 추가 또는 업데이트
          if (accountAddress && ownedTickets && ownedTickets > BigInt(0)) {
            ticketsMap.set(accountAddress, ownedTickets);
            console.log(
              "[Leaderboard] Updated current user's tickets:",
              ownedTickets.toString()
            );
          }

          // ticketsMap을 바탕으로 엔트리 배열 생성
          const entries: LeaderboardEntry[] = [];
          ticketsMap.forEach((tickets, address) => {
            if (tickets > BigInt(0)) {
              entries.push({
                rank: 0, // 정렬 후 할당
                address,
                tickets: tickets.toString(),
              });
            }
          });

          // 티켓 수 기준 내림차순 정렬
          entries.sort((a, b) => {
            const ticketsA = BigInt(a.tickets.toString());
            const ticketsB = BigInt(b.tickets.toString());
            return ticketsB > ticketsA ? 1 : ticketsB < ticketsA ? -1 : 0;
          });

          // 순위 할당
          entries.forEach((entry, index) => {
            entry.rank = index + 1;
          });

          setLeaderboardData(entries);
          setLeaderboardError(null);
          console.log("[Leaderboard] Final processed entries:", entries);
        } catch (error) {
          console.error("[Leaderboard] Error fetching leaderboard:", error);
          setLeaderboardError("Error fetching leaderboard data.");
          setLeaderboardData([]);
        } finally {
          setIsLoadingLeaderboard(false);
        }
      };

      // Initial data load
      fetchLeaderboardData();

      // Auto-refresh every 30 seconds
      const intervalId = setInterval(fetchLeaderboardData, 30000);

      // Cleanup function
      return () => clearInterval(intervalId);
    } else {
      // Display loading state if necessary data is missing
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

  // Helper function to initialize client object
  const waitForClient = async () => {
    try {
      // Get client object provided by viem or wagmi
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
              http: ["https://testnet-rpc.monad.xyz"],
            },
            public: {
              http: ["https://testnet-rpc.monad.xyz"],
            },
          },
        },
        transport: http("https://testnet-rpc.monad.xyz"),
      });
      return publicClient;
    } catch (error) {
      console.error("Error initializing public client:", error);
      return null;
    }
  };

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

  // Add handleSubmitTickets function right below this
  const handleSubmitTickets = async () => {
    if (!isConnected || !accountAddress) {
      toast.error("Please connect your wallet.");
      return;
    }
    if (!isCorrectNetwork) {
      toast.error(
        `Please switch network to ${
          targetChain?.name || `Chain ID: ${targetChainIdFromEnv}`
        }.`
      );
      return;
    }
    if (!lotteryAddress || !urukTokenAddress) {
      toast.error("Contract address not set. Please contact administrator.");
      return;
    }
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      toast.error("Please enter a valid quantity (integer greater than 0).");
      return;
    }
    if (urukDecimals === undefined) {
      toast.error("Fetching token information. Please try again shortly.");
      return;
    }

    setApproveArgs(undefined);
    setBuyTicketsArgs(undefined);
    resetApprove();
    resetBuyTickets();
    setCurrentTransactionStep("preparing");
    console.log("[handleSubmitTickets] Start. Quantity:", numQuantity);

    try {
      // Assume 1 URUK = 1 ticket. Price per ticket.
      const pricePerTicket = parseUnits("1", urukDecimals);
      // Total number of tickets user wants to buy (BigInt)
      const ticketsToBuyBigInt = BigInt(numQuantity);
      // Total URUK amount actually needed
      const amountNeeded = ticketsToBuyBigInt * pricePerTicket;

      console.log(
        `[handleSubmitTickets] Tickets to buy: ${ticketsToBuyBigInt}, Price per ticket: ${pricePerTicket}, Amount needed: ${amountNeeded}`
      );

      const refetchToastId = toast.loading(
        "Checking latest token allowance..."
      );
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
          "Unknown error";
        toast.error(`Failed to check latest allowance: ${errorMsg}`, {
          id: refetchToastId,
        });
        setCurrentTransactionStep("error");
        return;
      }

      const currentAllowance = currentAllowanceUnknown as bigint;
      toast.success("Latest allowance checked!", { id: refetchToastId });
      console.log(
        `[handleSubmitTickets] Fetched current allowance: ${formatUnits(
          currentAllowance,
          urukDecimals
        )} URUK. Amount needed: ${formatUnits(amountNeeded, urukDecimals)} URUK`
      );

      // Modified condition: approve if current allowance is less than the total amount actually needed
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
        // Assume buyTickets function takes the number of tickets
        setBuyTicketsArgs([ticketsToBuyBigInt]);

        // Explicitly delay state change to ensure state update is reflected
        setTimeout(() => {
          console.log(
            "[handleSubmitTickets] Setting transaction step to startingBuySimulation"
          );
          setCurrentTransactionStep("startingBuySimulation");
        }, 500);
      }
    } catch (error: any) {
      console.error("[handleSubmitTickets] Error:", error);
      toast.error(
        `Error preparing tickets: ${error.message || "Unknown error"}`
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
  const isCountdownLoading =
    isLoadingActiveRound || isLoadingEndTime || countdown === null;

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
              Leaderboard (Round #{activeRoundId?.toString() ?? "..."})
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
                  {parseFloat(urukBalanceFormatted).toLocaleString()} $URUK
                </span>
              )}
            </p>
          </div>

          {/* Ticket ownership display (existing part) */}
          <div className="bg-black/30 px-4 py-2 rounded-md border border-purple-500/30">
            <p className="text-base font-medium text-purple-200">
              My Ticket:{" "}
              {!isClient ||
              isLoadingOwnedTickets ||
              isLoadingActiveRound ||
              activeRoundId === undefined ? (
                <span className="text-lg font-bold text-white animate-pulse">
                  Loading...
                </span>
              ) : (
                <span className="text-lg font-bold text-white font-joystix">
                  {ownedTickets?.toString() ?? "0"}
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

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

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [countdown, setCountdown] = useState<{
    minutes: number;
    seconds: number;
  } | null>(null);
  const [roundEndTime, setRoundEndTime] = useState<number | null>(null); // Unix timestamp (seconds)

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
        staleTime: 1000 * 60 * 60 * 24,
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
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60 * 5,
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
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60 * 10, // 10분
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
  const { data: activeRoundIdData, isLoading: isLoadingActiveRound } =
    useReadContract({
      address: lotteryAddress,
      abi: UrukLotteryABI,
      functionName: "activeRoundId",
      chainId: targetChainIdFromEnv,
      query: {
        enabled:
          !!lotteryAddress && isConnected && isCorrectNetwork && isClient,
        staleTime: 1000 * 60 * 5,
      },
    });
  const activeRoundId = activeRoundIdData as bigint | undefined;

  // Get Round End Time using roundEnd function
  const { data: roundEndTimeData, isLoading: isLoadingEndTime } =
    useReadContract({
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
        staleTime: 1000 * 60 * 5,
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
    functionName: "getTicketsOf", // Ensure this matches the function name in the contract
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
      staleTime: 1000 * 60 * 5,
    },
  });
  const ownedTickets = ownedTicketsData as bigint | undefined;

  // --- 로터리 풀의 URUK 잔액 (총 상금) ---
  const {
    data: lotteryPoolBalanceData,
    isLoading: isLoadingLotteryPoolBalance,
    refetch: refetchLotteryPoolBalance, // 필요시 refetch 함수 사용 가능
  } = useReadContract({
    address: urukTokenAddress, // URUK 토큰 컨트랙트 주소
    abi: UrukTokenABI, // URUK 토큰 ABI
    functionName: "balanceOf",
    args: lotteryAddress ? [lotteryAddress] : undefined, // 로터리 컨트랙트 주소를 인자로 전달
    chainId: targetChainIdFromEnv,
    query: {
      enabled:
        !!urukTokenAddress &&
        !!lotteryAddress &&
        urukDecimals !== undefined && // decimals 정보가 있어야 포맷 가능
        isConnected && // 사용자가 연결되어 있을 때만 표시 (선택적)
        isCorrectNetwork &&
        isClient,
      staleTime: 1000 * 60 * 5, // 5분마다 stale (상금 풀은 자주 변동 가능)
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

  // UPDATED: Countdown timer - uses roundEndTime state directly
  const calculateCountdown = useCallback(() => {
    if (roundEndTime === null || roundEndTime === undefined) {
      setCountdown(null);
      return true; // Indicate timer should stop if no end time
    }
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = roundEndTime - now;

    if (remainingSeconds <= 0) {
      setCountdown({ minutes: 0, seconds: 0 });
      return true;
    } else {
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      setCountdown({ minutes, seconds });
      return false;
    }
  }, [roundEndTime]);

  useEffect(() => {
    const stopped = calculateCountdown();
    if (stopped) return;

    const timer = setInterval(() => {
      if (calculateCountdown()) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [calculateCountdown]);

  // Fetch Leaderboard Data
  useEffect(() => {
    if (activeRoundId !== undefined) {
      const fetchLeaderboard = async () => {
        setIsLoadingLeaderboard(true);
        setLeaderboardError(null);
        try {
          // TODO: 실제 API 엔드포인트 URL로 변경하고, 필요시 에러 처리 로직 개선
          const response = await fetch(
            `${LEADERBOARD_API_URL}${activeRoundId.toString()}`
          );
          if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
          }
          const data: LeaderboardEntry[] = await response.json();
          // TODO: API 응답 형식에 따라 데이터 가공이 필요할 수 있음
          // 예: rank 필드가 없다면 index를 사용, tickets가 string이면 number로 변환 등
          setLeaderboardData(data.slice(0, 10)); // 상위 10개만 표시
        } catch (error) {
          console.error("Error fetching leaderboard:", error);
          setLeaderboardError("Failed to load leaderboard data.");
          setLeaderboardData([]); // 에러 시 빈 배열로 설정
        } finally {
          setIsLoadingLeaderboard(false);
        }
      };
      fetchLeaderboard();
    } else {
      // activeRoundId를 아직 못 가져왔으면 리더보드 로딩 상태 유지 또는 초기화
      setIsLoadingLeaderboard(true);
      setLeaderboardData([]);
    }
  }, [activeRoundId]); // activeRoundId가 변경되면 리더보드를 다시 가져옵니다.

  // NEW: 이전 `buyTicketsConfig Effect`를 이 형태로 수정하거나 대체
  useEffect(() => {
    // 로딩이 끝났을 때만 검사
    if (!isLoadingBuyTicketsSimulate) {
      if (
        buyTicketsConfig?.request &&
        !buyTicketsErrorSimulate &&
        currentTransactionStep === "startingBuySimulation"
      ) {
        console.log(
          "[SimulateEffect] Simulation successful for 'startingBuySimulation'. Transitioning to 'buying'. Request:",
          buyTicketsConfig.request
        );
        setCurrentTransactionStep("buying");
      } else if (
        buyTicketsErrorSimulate &&
        currentTransactionStep === "startingBuySimulation"
      ) {
        // 시뮬레이션이 로딩 후 에러로 끝난 경우 (이미 에러 핸들러 useEffect가 있지만, 여기서도 처리 가능)
        console.error(
          "[SimulateEffect] Simulation failed for 'startingBuySimulation'. Error:",
          buyTicketsErrorSimulate
        );
        // setCurrentTransactionStep("error"); // 이미 다른 에러 핸들러에서 처리 중
      }
    }
  }, [
    isLoadingBuyTicketsSimulate, // 이 상태의 false로의 변경이 중요
    buyTicketsConfig,
    buyTicketsErrorSimulate,
    currentTransactionStep,
    // setCurrentTransactionStep // Setter 함수는 일반적으로 의존성 배열에 불필요
  ]);

  // UPDATED: [EFFECT CheckBuyTicketsAsync] -> 이제 [EFFECT SendBuyTransaction] 등으로 이름 변경 가능
  // buyTicketsAsync 호출 조건 수정
  useEffect(() => {
    console.log(
      "[EFFECT ApproveConfig] Checking conditions. Step:",
      currentTransactionStep,
      "Args:",
      approveArgs,
      "Config:",
      !!approveConfig?.request,
      "isApproving:",
      isApproving,
      "Data:",
      approveData,
      "isLoadingSim:",
      isLoadingApproveSimulate
    );

    if (
      currentTransactionStep === "approving" &&
      approveConfig?.request &&
      approveArgs &&
      !isApproving &&
      !approveData &&
      !isLoadingApproveSimulate
    ) {
      console.log(
        "[EFFECT ApproveConfig] Conditions MET for sending approve transaction. Step:",
        currentTransactionStep
      );
      (async () => {
        let toastId = "approve-tx-send";
        try {
          console.log(
            "[EFFECT approveAsync] Sending approve transaction with config:",
            approveConfig.request
          );
          toast.loading("URUK 사용 승인 트랜잭션 전송 중...", { id: toastId });
          await approveAsync(approveConfig.request);
          console.log("[EFFECT approveAsync] Approve transaction submitted.");
          toast.success("URUK 사용 승인 트랜잭션이 전송되었습니다.", {
            id: toastId,
            duration: 3000,
          });
          // isSuccessApprove useEffect에서 다음 단계로 진행
        } catch (e) {
          console.error(
            "[EFFECT approveAsync] Approve transaction submission error:",
            e
          );
          const errorMsg =
            (e as any)?.shortMessage ||
            (e as Error)?.message ||
            "알 수 없는 오류";
          toast.error(`URUK 사용 승인 오류: ${errorMsg}`, {
            id: toastId,
          });
          setCurrentTransactionStep("error");
          setIsTransactionProcessing(false);
          // resetApprove(); // 실패 시 reset
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
    isLoadingApproveSimulate,
  ]);

  // Approval success effect
  useEffect(() => {
    if (isSuccessApprove && approveData) {
      console.log(
        `[isSuccessApprove useEffect] Approval transaction successful with hash: ${approveData}. Current step: ${currentTransactionStep}`
      );

      if (currentTransactionStep !== "approving") {
        console.log(
          "[isSuccessApprove useEffect] Not in 'approving' state anymore. Current state:",
          currentTransactionStep
        );
        return;
      }

      // 승인이 완료되면 다음 단계(buyTickets 시뮬레이션)로 진행
      console.log(
        "[isSuccessApprove useEffect] Proceeding to buyTickets simulation."
      );
      setBuyTicketsArgs([BigInt(parseInt(quantity, 10))]);
      setCurrentTransactionStep("startingBuySimulation");

      toast.success(
        <div className="flex flex-col">
          <span>URUK 사용 승인 완료!</span>
          <a
            href={getExplorerUrl(approveData)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline mt-1"
          >
            View Transaction
          </a>
        </div>,
        { duration: 4000 }
      );
    }
  }, [
    isSuccessApprove,
    approveData,
    currentTransactionStep,
    setCurrentTransactionStep,
    setBuyTicketsArgs,
    quantity,
  ]);

  // UPDATED: [EFFECT CheckBuyTicketsAsync] -> 이제 [EFFECT SendBuyTransaction] 등으로 이름 변경 가능
  // buyTicketsAsync 호출 조건 수정
  useEffect(() => {
    // 이전 로그 유지
    console.log(
      "[EFFECT CheckBuyTicketsAsync] Checking conditions. Step:",
      currentTransactionStep,
      "Args:",
      buyTicketsArgs,
      "ConfReq:",
      !!buyTicketsConfig?.request,
      "isBuying:",
      isBuyingTickets,
      "Data:",
      buyTicketsData,
      "isLoadingSim:",
      isLoadingBuyTicketsSimulate
    );

    if (
      currentTransactionStep === "buying" && // ★ Step이 'buying'일 때
      buyTicketsConfig?.request && // ★ 시뮬레이션 결과가 있어야 함
      buyTicketsArgs && // buyTicketsArgs가 설정되어 있어야 함
      !isBuyingTickets && // 이미 보내고 있는 중이 아니어야 함
      !buyTicketsData // 이미 완료된 tx가 없어야 함
    ) {
      console.log(
        "[EFFECT CheckBuyTicketsAsync] Conditions MET for sending buy transaction. Step:",
        currentTransactionStep
      );
      (async () => {
        let toastId = "buy-tx-send"; // 이전 toastId와 중복 피하기
        try {
          console.log(
            "[EFFECT buyTicketsAsync] Sending buyTickets transaction with config:",
            buyTicketsConfig.request
          );
          toast.loading("티켓 구매 트랜잭션 전송 중...", { id: toastId });
          await buyTicketsAsync(buyTicketsConfig.request); // 여기서 buyTicketsAsync 호출
          console.log(
            "[EFFECT buyTicketsAsync] BuyTickets transaction submitted."
          );
          // 성공 토스트는 isSuccessBuyTickets useEffect에서 처리
        } catch (e) {
          console.error(
            "[EFFECT buyTicketsAsync] BuyTickets transaction submission error:",
            e
          );
          const errorMsg =
            (e as any)?.shortMessage ||
            (e as Error)?.message ||
            "알 수 없는 오류";
          toast.error(`티켓 구매 트랜잭션 제출 오류: ${errorMsg}`, {
            id: toastId,
          });
          setCurrentTransactionStep("error");
          setIsTransactionProcessing(false);
          // resetBuyTickets(); // 실패 시 reset
        }
      })();
    } else if (buyTicketsArgs && currentTransactionStep === "buying") {
      // 'buying' 상태인데 조건 미충족 시 상세 로그
      console.log(
        "[EFFECT CheckBuyTicketsAsync] Conditions NOT MET for sending transaction in 'buying' step. Details:",
        {
          step: currentTransactionStep,
          hasConfig: !!buyTicketsConfig?.request,
          hasArgs: !!buyTicketsArgs,
          isBuying: isBuyingTickets,
          hasData: !!buyTicketsData,
        }
      );
    }
  }, [
    buyTicketsConfig,
    buyTicketsAsync,
    buyTicketsArgs,
    currentTransactionStep,
    isBuyingTickets,
    buyTicketsData,
    isLoadingBuyTicketsSimulate, // 이 효과에서 isLoadingBuyTicketsSimulate도 확인 (무한루프 방지 등)
    // 상태설정 함수는 의존성 배열에서 일반적으로 제외
  ]);

  // UPDATED: Transaction completion effect (Toast 알림 추가)
  useEffect(() => {
    if (isSuccessBuyTickets && buyTicketsData) {
      console.log(
        `[isSuccessBuyTickets useEffect] Transaction successful with hash: ${buyTicketsData}. Current step: ${currentTransactionStep}`
      ); // 로그 추가

      // 이미 completed 상태이거나 다른 상태로 넘어갔으면 중복 실행 방지 (선택적)
      if (currentTransactionStep === "completed") {
        console.log(
          "[isSuccessBuyTickets useEffect] Already completed. Skipping."
        );
        return;
      }

      setCurrentTransactionStep("completed");

      toast.success(
        <div className="flex flex-col">
          <span>
            {buyTicketsArgs?.[0]?.toString() || quantity}개의 티켓 구매 성공!
          </span>
          {buyTicketsData && (
            <a
              href={getExplorerUrl(buyTicketsData)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline mt-1"
            >
              View Transaction
            </a>
          )}
        </div>,
        { duration: 5000 }
      );

      setQuantity("");
      refetchUrukBalance();
      refetchOwnedTickets();
      // refetchUrukAllowance(); // maxUint256이므로 필수는 아님
      refetchLotteryPoolBalance();
      resetApprove();
      resetBuyTickets();
      setApproveArgs(undefined);
      setBuyTicketsArgs(undefined);
      setIsTransactionProcessing(false); // ★ 무한 로딩 해결의 핵심
      console.log(
        "[isSuccessBuyTickets useEffect] Transaction processing finished. isTransactionProcessing: false"
      );
    } else if (
      buyTicketsData &&
      !isSuccessBuyTickets &&
      !isConfirmingBuyTickets &&
      currentTransactionStep !== "error"
    ) {
      // 트랜잭션 해시는 있는데 아직 성공/확인중이 아닌 경우 (예: 실패했지만 isError 플래그가 없는 경우)
      console.warn(
        `[isSuccessBuyTickets useEffect] buyTicketsData exists (${buyTicketsData}), but isSuccessBuyTickets is false and not confirming. Current step: ${currentTransactionStep}. This might indicate a stalled or failed tx not caught by error handlers.`
      );
    }
  }, [
    isSuccessBuyTickets,
    isConfirmingBuyTickets, // 의존성 추가
    buyTicketsData,
    currentTransactionStep, // currentTransactionStep을 의존성에 추가하여 상태 변경 시 재평가 (순환 주의)
    refetchUrukBalance,
    refetchOwnedTickets,
    // refetchUrukAllowance,
    refetchLotteryPoolBalance,
    quantity, // toast 메시지에 사용
    resetApprove,
    resetBuyTickets,
    buyTicketsArgs, // toast 메시지에 사용
    setCurrentTransactionStep, // 상태 변경 함수 의존성 추가 (ESLint 권고 시)
    setIsTransactionProcessing, // 상태 변경 함수 의존성 추가 (ESLint 권고 시)
    setQuantity,
    setApproveArgs,
    setBuyTicketsArgs, // 추가적인 setter 함수들
  ]);

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
        setCurrentTransactionStep("startingBuySimulation");
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

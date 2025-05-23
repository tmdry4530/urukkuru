"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useChainId } from "wagmi";
import { formatUnits } from "ethers";
import type { JsonFragment } from "ethers"; // Abi 대신 JsonFragment 사용 시도

// TODO: 실제 URUK 토큰 ABI로 교체하고, 별도 파일로 분리하여 import 권장
const UrukTokenABI: ReadonlyArray<JsonFragment> = [
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
] as const; // as const 추가하여 타입을 더 정확하게 추론하도록 도움

const urukTokenAddress = process.env.NEXT_PUBLIC_URUK_TOKEN as
  | `0x${string}`
  | undefined;
const targetChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "10143", 10);

// 승자 정보 배열
const winners = [
  {
    round: 1,
    address: "0x18Fa797f6588B06100a55826EA0B85720cAe458c",
    amount: 127579,
  },
  {
    round: 2,
    address: "0x219fEdB468660C8C761ff3e1e90D0b7d3c3dFAA1",
    amount: 624864,
  },
  {
    round: 3,
    address: "0xb8f1bA7E145E33c0E7FDA17e7D078c096a9d1584",
    amount: 1021986,
  },
  {
    round: 4,
    address: "0x658A88117237105Fb3E16B68Ca50EB7F76B0747F",
    amount: 703677,
  },
];

// 주소 축약 함수
const shortenAddress = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};

// 수량 포맷팅 함수
const formatAmount = (amount: number) => {
  return amount.toLocaleString();
};

export function Header() {
  const [glowIntensity, setGlowIntensity] = useState(1);
  const [isClient, setIsClient] = useState(false);

  const { address: accountAddress, isConnected } = useAccount();
  const currentChainId = useChainId();
  const isCorrectNetwork = currentChainId === targetChainId;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // URUK Token Balance and Decimals for Header display
  const { data: urukDecimalsData, isLoading: isLoadingUrukDecimals } =
    useReadContract({
      address: urukTokenAddress,
      abi: UrukTokenABI,
      functionName: "decimals",
      chainId: targetChainId,
      query: {
        enabled:
          !!urukTokenAddress && isConnected && isCorrectNetwork && isClient,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
      },
    });
  const urukDecimals =
    typeof urukDecimalsData === "number"
      ? urukDecimalsData
      : typeof urukDecimalsData === "bigint"
      ? Number(urukDecimalsData)
      : undefined;

  const { data: urukBalanceData, isLoading: isLoadingUrukBalance } =
    useReadContract({
      address: urukTokenAddress,
      abi: UrukTokenABI,
      functionName: "balanceOf",
      args: accountAddress ? [accountAddress] : undefined,
      chainId: targetChainId,
      query: {
        enabled:
          !!urukTokenAddress &&
          !!accountAddress &&
          urukDecimals !== undefined && // after decimals load
          isCorrectNetwork &&
          isClient,
        staleTime: 1000 * 30, // 30 seconds
      },
    });
  const urukBalance = urukBalanceData as bigint | undefined;

  const urukBalanceFormatted =
    urukBalance !== undefined && urukDecimals !== undefined
      ? parseFloat(formatUnits(urukBalance, urukDecimals)).toFixed(2)
      : "0";

  // Animate glow effect using requestAnimationFrame for stability
  useEffect(() => {
    let animationFrameId: number;
    let lastUpdateTime = 0;
    const updateInterval = 100; // 100ms, same as original setInterval
    let isRunning = true;

    const animateGlow = (timestamp: number) => {
      if (!isRunning) return;

      if (timestamp - lastUpdateTime >= updateInterval) {
        setGlowIntensity((prev) => {
          const newValue = prev + 0.05 * (Math.random() > 0.5 ? 1 : -1);
          return Math.max(0.8, Math.min(1.2, newValue));
        });
        lastUpdateTime = timestamp;
      }
      animationFrameId = requestAnimationFrame(animateGlow);
    };

    animationFrameId = requestAnimationFrame(animateGlow);

    return () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const showUserBalance = isClient && isConnected && isCorrectNetwork;

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#1a0028]/80 border-b border-purple-500/30 px-4 py-2">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <div className="relative w-8 h-8 mr-2 transform group-hover:scale-110 transition-transform">
              <Image
                src="/logo.png"
                alt="URUK Logo"
                width={32}
                height={32}
                className="object-contain"
                style={{
                  filter: `drop-shadow(0 0 ${
                    4 * glowIntensity
                  }px rgba(255, 0, 255, 0.8))`,
                }}
              />
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-gradient font-joystix">
              URUK
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-4">
              <Link
                href="/"
                className="relative px-2 py-1 text-xs font-medium transition-colors hover:text-pink-400 group font-joystix"
              >
                Home
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link
                href="/tokenomics"
                className="relative px-2 py-1 text-xs font-medium transition-colors hover:text-pink-400 group font-joystix"
              >
                Tokenomics
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link
                href="/story"
                className="relative px-2 py-1 text-xs font-medium transition-colors hover:text-pink-400 group font-joystix"
              >
                Story
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <a
                href="https://www.kuru.io/trade/0x5d6506e92b0a1205bd717b66642e961edad0a884"
                target="_blank"
                rel="noopener noreferrer"
                className="relative px-2 py-1 text-xs font-medium transition-colors hover:text-pink-400 group font-joystix"
              >
                Trade $URUK
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </a>
            </div>

            <div className="flex items-center space-x-1">
              <div className="transform scale-75 md:scale-90">
                <ConnectButton
                  accountStatus={{
                    smallScreen: "avatar",
                    largeScreen: "full",
                  }}
                  showBalance={{
                    smallScreen: false,
                    largeScreen: false, // Use custom balance display above
                  }}
                />
              </div>
            </div>

            <button className="md:hidden text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Announcement Bar - 승자 표시 */}
      <div className="w-full bg-gradient-to-r from-pink-900/30 to-purple-900/30 backdrop-blur-sm py-3 px-4 text-center text-sm overflow-hidden font-joystix">
        <div className="animate-marquee whitespace-nowrap">
          {winners.map((winner, index) => (
            <span key={index} className="mx-4">
              {winner.round}Round winner: {shortenAddress(winner.address)}{" "}
              {formatAmount(winner.amount)} $URUK
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

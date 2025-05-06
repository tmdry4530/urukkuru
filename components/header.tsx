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

    const animateGlow = (timestamp: number) => {
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
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const showUserBalance = isClient && isConnected && isCorrectNetwork;

  return (
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
  );
}

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  const [glowIntensity, setGlowIntensity] = useState(1);

  // Animate glow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowIntensity((prev) => {
        const newValue = prev + 0.05 * (Math.random() > 0.5 ? 1 : -1);
        return Math.max(0.8, Math.min(1.2, newValue));
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#1a0028]/80 border-b border-purple-500/30 px-4 py-3">
      <nav className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          <div className="relative w-10 h-10 mr-2 transform group-hover:scale-110 transition-transform">
            <Image
              src="/placeholder.svg?height=40&width=40"
              alt="URUK Logo"
              width={40}
              height={40}
              className="object-contain"
              style={{
                filter: `drop-shadow(0 0 ${
                  5 * glowIntensity
                }px rgba(255, 0, 255, 0.8))`,
              }}
            />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-gradient">
            URUK
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-6">
          <Link
            href="/tokenomics"
            className="relative px-3 py-2 text-sm font-medium transition-colors hover:text-pink-400 group"
          >
            토크노믹스
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
          </Link>
          <Link
            href="/story"
            className="relative px-3 py-2 text-sm font-medium transition-colors hover:text-pink-400 group"
          >
            스토리
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
          </Link>
          <Link
            href="#"
            className="relative px-3 py-2 text-sm font-medium transition-colors hover:text-pink-400 group"
          >
            토큰구매
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
          </Link>
          <Link
            href="#"
            className="ml-4 px-3 py-2 text-sm font-medium bg-gradient-to-r from-pink-600 to-purple-600 rounded-md hover:from-pink-500 hover:to-purple-500 transition-colors"
          >
            <ConnectButton />
          </Link>
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
      </nav>
    </header>
  );
}

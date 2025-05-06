"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { PageLayout } from "@/components/page-layout";

export default function Home() {
  const [countdown, setCountdown] = useState({ minutes: 30, seconds: 0 });
  const [quantity, setQuantity] = useState("");
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

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds === 0) {
          if (prev.minutes === 0) {
            clearInterval(timer);
            return prev;
          }
          return { minutes: prev.minutes - 1, seconds: 59 };
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PageLayout>
      {/* Main Content Section */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Timer Box */}
        <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 flex flex-col items-center justify-center shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow">
          <h3 className="text-lg font-medium text-purple-200 mb-3">
            이번 뽑깟 남은시간
          </h3>
          <div className="text-4xl font-bold text-white flex items-center">
            <span>{String(countdown.minutes).padStart(2, "0")}</span>
            <span className="mx-1 animate-pulse">:</span>
            <span>{String(countdown.seconds).padStart(2, "0")}</span>
          </div>
        </div>

        {/* Center Logo */}
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-gradient">
            URUK
          </h1>
          <div className="relative w-48 h-48">
            <Image
              src="/placeholder.svg?height=192&width=192"
              alt="URUK Cat Logo"
              width={192}
              height={192}
              className="object-contain"
              style={{
                filter: `drop-shadow(0 0 ${
                  10 * glowIntensity
                }px rgba(255, 0, 255, 0.7))`,
              }}
            />
          </div>
        </div>

        {/* Leaderboard Box */}
        <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow">
          <h3 className="text-lg font-medium text-purple-200 mb-3 text-center">
            리더보드
          </h3>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((rank) => (
              <div key={rank} className="flex justify-between items-center">
                <span className="text-sm">{rank}등</span>
                <span className="text-sm text-gray-400">-</span>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-purple-500/30">
              <div className="flex justify-between items-center">
                <span className="text-sm">토큰 누적 당첨수</span>
                <span className="text-sm font-medium text-pink-400">
                  10000000 개
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-7 gap-4 mb-12">
        <button className="md:col-span-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-pink-600/30">
          Trade $URUK
        </button>

        <div className="md:col-span-3 relative">
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="수량입력"
            className="w-full bg-black/30 border border-purple-500/50 rounded-md py-3 px-4 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
          />
        </div>

        <button className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-600/30">
          제출
        </button>
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
            "All $URUK spent on tickets goes into the prize pool.",
            "One lucky winner gets the entire pool of $URUK.",
            " A winner is picked every 6 hours, and the prize gets airdropped straight to their wallet!", // 4번째 항목에 대한 플레이스홀더입니다.
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

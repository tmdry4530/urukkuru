"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { PageLayout } from "@/components/page-layout";

export default function Home() {
  const [countdown, setCountdown] = useState({ minutes: 30, seconds: 0 });
  const [quantity, setQuantity] = useState("");
  const [glowIntensity, setGlowIntensity] = useState(1);
  const [ownedTickets, setOwnedTickets] = useState(0);

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

  const handleSubmitTickets = () => {
    const numQuantity = parseInt(quantity, 10);
    if (!isNaN(numQuantity) && numQuantity > 0) {
      setOwnedTickets((prevTickets) => prevTickets + numQuantity);
      setQuantity("");
    } else {
      alert("유효한 수량을 입력해주세요.");
    }
  };

  return (
    <PageLayout>
      {/* Main Content Section - max-width와 grid-cols 변경 */}
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
          {/* Combined Countdown and Prize Pool Box - max-w-sm 제거 */}
          <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 flex flex-col items-center justify-center shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow w-full flex-1">
            <h3 className="text-lg font-medium text-purple-200 mb-1">
              countdown
            </h3>
            <div className="text-4xl font-bold text-white flex items-center mb-3">
              <span>{String(countdown.minutes).padStart(2, "0")}</span>
              <span className="mx-1 animate-pulse">:</span>
              <span>{String(countdown.seconds).padStart(2, "0")}</span>
            </div>
            <div className="text-center">
              <span className="text-sm text-purple-200">Total Prize : </span>
              <span className="text-sm font-medium text-pink-400">
                10000000 $URUK
              </span>
            </div>
          </div>

          {/* Leaderboard Box - max-w-sm 제거 */}
          <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-900/20 hover:shadow-purple-700/30 transition-shadow w-full flex-1">
            <h3 className="text-lg font-medium text-purple-200 mb-3 text-center">
              Leaderboard
            </h3>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => (
                <div key={rank} className="flex justify-between items-center">
                  <span className="text-sm">{rank}</span>
                  <span className="text-sm text-gray-400">-</span>
                </div>
              ))}
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
          <button className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-pink-600/30">
            Trade $URUK
          </button>
        </a>

        <div className="md:col-span-3 relative">
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity ($URUK)"
            className="w-full bg-black/30 border border-purple-500/50 rounded-md py-3 px-4 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleSubmitTickets}
          className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-3 px-6 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-600/30"
        >
          Submit
        </button>
      </div>

      {/* Owned Tickets Display Section */}
      <div className="max-w-4xl mx-auto w-full mb-8 text-center">
        <p className="text-xl font-medium text-purple-200">
          My Ticket:{" "}
          <span className="text-2xl font-bold text-white">{ownedTickets}</span>{" "}
          🎟️
        </p>
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

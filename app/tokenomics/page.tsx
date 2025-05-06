"use client";

import { useState, useEffect } from "react";
import Image from "next/image"; // Image 컴포넌트 import 확인
import { PageLayout } from "@/components/page-layout";

export default function TokenomicsPage() {
  const [isChartVisible, setIsChartVisible] = useState(false);
  // hoveredSegment 상태 제거

  // tokenDistribution은 이미지의 일부로 표현되므로, 필요시 주석 처리하거나 다른 용도로 사용 가능
  // const tokenDistribution = [
  //   { name: "팀", percentage: 30, color: "#FF5E8F" },
  //   { name: "커뮤니티", percentage: 25, color: "#9D4EDD" },
  //   { name: "리워드", percentage: 25, color: "#6A0DAD" },
  //   { name: "유동성", percentage: 10, color: "#3A0CA3" },
  //   { name: "예비비", percentage: 10, color: "#4361EE" },
  // ]

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChartVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // createPieSegments 함수 제거

  return (
    <PageLayout>
      {/* Page content container: Uses flex-1 to take available space in PageLayout's main, centers content, and hides overflow */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-4">
        {/* Outer image wrapper: Controls max-width of the image area, centers actual image container */}
        <div
          className={`relative transition-opacity duration-1000 ${
            isChartVisible ? "opacity-100" : "opacity-0"
          } w-full max-w-4xl flex items-center justify-center`}
        >
          {/* Floating particles (should be contained by overflow-hidden on parent if they exceed bounds) */}
          {/* 아래 페이지 자체 파티클 코드 주석 처리 또는 제거 */}
          {/* <div className="absolute inset-0 -m-10 overflow-hidden pointer-events-none"> */}
          {/*   {[...Array(15)].map((_, i) => ( */}
          {/*     <div */}
          {/*       key={i} */}
          {/*       className="absolute rounded-full bg-gradient-to-r from-pink-500 to-purple-500 opacity-20 animate-pulse" */}
          {/*       style={{ */}
          {/*         width: `${Math.random() * 8 + 3}px`, */}
          {/*         height: `${Math.random() * 8 + 3}px`, */}
          {/*         top: `${Math.random() * 100}%`, */}
          {/*         left: `${Math.random() * 100}%`, */}
          {/*         filter: "blur(2px)", */}
          {/*         animationDuration: `${Math.random() * 10 + 5}s`, */}
          {/*         animationDelay: `${Math.random() * 5}s`, */}
          {/*       }} */}
          {/*     /> */}
          {/*   ))} */}
          {/* </div> */}

          {/* Image container: Square aspect ratio, takes full width of its parent (up to max-w-4xl), max height constrained by parent */}
          {/* No explicit h-full or max-h-full needed here if parent has flex item behavior and overflow hidden */}
          <div className="relative w-full aspect-square">
            <Image
              src="/tokenomics.png"
              alt="Tokenomics Diagram"
              layout="fill"
              objectFit="contain"
              className={`transition-opacity duration-500 ease-in-out ${
                isChartVisible ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

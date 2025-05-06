"use client";

import { useState, useEffect } from "react";
import Image from "next/image"; // Image 컴포넌트 import 확인
import { PageLayout } from "@/components/page-layout";

export default function TokenomicsPage() {
  const [isChartVisible, setIsChartVisible] = useState(false);

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

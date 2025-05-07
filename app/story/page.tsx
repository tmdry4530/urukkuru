"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PageLayout } from "@/components/page-layout";

export default function StoryPage() {
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const storyContent = {
    title: "The Legend of URUK",
    content: `A long time ago, around 4000 BCE, in the middle of ancient Mesopotamia, a mysterious cat suddenly appeared in a bustling city. Its fur seemed to shimmer under the moonlight, and wherever it walked, it left behind little treasures that amazed the people.

But the most curious thing was the sound it made—it would wander the streets at night, softly calling out:
"Uruk Uruk Uruk"

The people were so fascinated by this strange cat and its mysterious cry that they started calling it "Uruk." Before long, the city itself took on the name, forever honoring the legendary cat that had once watched over them.`,
  };

  return (
    <PageLayout>
      <div
        className={`font-joystix max-w-4xl mx-auto w-full transition-opacity duration-1000 ease-in-out ${
          pageLoaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-gradient">
          The Story of URUK
        </h1>

        {/* Hero Image */}
        <div className="relative w-full h-64 md:h-96 mb-12 rounded-lg overflow-hidden">
          <Image
            src="/story.png"
            alt="URUK Story Banner"
            fill
            className="object-contain"
          />
          {/* 아래 그라데이션 div 제거 */}
          {/* <div className="absolute inset-0 bg-gradient-to-t from-[#1a0028] to-transparent"></div> */}
        </div>

        {/* Story Content - 단일 섹션으로 변경 */}
        <div className="space-y-6 mb-16">
          <h3 className="text-3xl font-bold mb-4 text-purple-200 relative inline-block group">
            {storyContent.title}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
          </h3>
          <p className="text-gray-200 leading-relaxed whitespace-pre-line">
            {storyContent.content}
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { PageLayout } from "@/components/page-layout"

export default function StoryPage() {
  const [visibleSections, setVisibleSections] = useState<number[]>([])
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"))
            if (!visibleSections.includes(index)) {
              setVisibleSections((prev) => [...prev, index])
            }
          }
        })
      },
      { threshold: 0.3 },
    )

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => {
      sectionRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref)
      })
    }
  }, [visibleSections])

  const storyParagraphs = [
    {
      title: "URUK의 탄생",
      content:
        "먼 미래, 디지털 세계와 현실이 융합된 시대에 URUK이 탄생했습니다. 인공지능과 블록체인 기술이 발전하면서, 새로운 형태의 디지털 자산이 등장했고, 그 중심에 URUK이 있었습니다. 처음에는 단순한 디지털 토큰으로 시작했지만, 곧 그 가치는 상상을 초월하게 되었습니다.",
    },
    {
      title: "사이버 세계의 화폐",
      content:
        "URUK은 단순한 화폐를 넘어 사이버 세계의 새로운 질서를 만들어냈습니다. 네온빛이 가득한 도시의 밤거리에서, 사람들은 URUK을 통해 거래하고, 소통하고, 꿈을 이루었습니다. 가상과 현실의 경계가 무너지는 순간, URUK은 그 중심에서 빛나고 있었습니다.",
    },
    {
      title: "로터리의 시작",
      content:
        "어느 날, URUK 생태계에 새로운 시스템이 도입되었습니다. 바로 '로터리'였습니다. 참가자들은 URUK 토큰을 걸고 운명의 게임에 참여했습니다. 이 게임은 단순한 도박이 아닌, 블록체인 기술을 통해 완벽하게 투명하고 공정한 방식으로 운영되었습니다. 모든 거래와 당첨 과정이 블록체인에 기록되어 누구나 확인할 수 있었습니다.",
    },
    {
      title: "커뮤니티의 성장",
      content:
        "URUK 로터리는 빠르게 인기를 얻었고, 전 세계의 참가자들이 모여들었습니다. 사람들은 단순히 상금을 위해서가 아니라, 함께 만들어가는 커뮤니티의 일원이 되기 위해 참여했습니다. 매주 열리는 로터리는 축제와 같은 분위기를 자아냈고, 참가자들은 서로의 성공을 축하하며 더욱 강한 유대감을 형성했습니다.",
    },
    {
      title: "미래를 향한 여정",
      content:
        "이제 URUK은 단순한 로터리를 넘어, 디지털 경제의 새로운 패러다임을 제시하고 있습니다. 지속적인 기술 혁신과 커뮤니티의 참여로, URUK은 계속해서 진화하고 있습니다. 미래에는 어떤 모습으로 우리 앞에 나타날지, 그 여정은 지금도 계속되고 있습니다.",
    },
  ]

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-gradient">
          스토리
        </h1>

        {/* Hero Image */}
        <div className="relative w-full h-64 md:h-96 mb-12 rounded-lg overflow-hidden">
          <Image
            src="/placeholder.svg?height=400&width=800"
            alt="URUK Story"
            fill
            className="object-cover"
            style={{
              filter: "hue-rotate(270deg) brightness(0.8)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0028] to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full p-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">사이버펑크 세계의 URUK</h2>
          </div>
        </div>

        {/* Story Content */}
        <div className="space-y-12 mb-16">
          {storyParagraphs.map((paragraph, index) => (
            <div
              key={index}
              ref={(el) => (sectionRefs.current[index] = el)}
              data-index={index}
              className={`transition-opacity duration-1000 ${
                visibleSections.includes(index) ? "opacity-100" : "opacity-0"
              }`}
            >
              <h3 className="text-2xl font-bold mb-4 text-purple-200 relative inline-block group">
                {paragraph.title}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </h3>
              <p className="text-gray-200 leading-relaxed">{paragraph.content}</p>
            </div>
          ))}
        </div>

        {/* Quote Section */}
        <div
          ref={(el) => (sectionRefs.current[storyParagraphs.length] = el)}
          data-index={storyParagraphs.length}
          className={`bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-8 mb-12 text-center transition-opacity duration-1000 ${
            visibleSections.includes(storyParagraphs.length) ? "opacity-100" : "opacity-0"
          }`}
        >
          <blockquote className="text-xl md:text-2xl italic text-purple-200 mb-4">
            "URUK은 단순한 토큰이 아닌, 새로운 디지털 세계의 시작입니다."
          </blockquote>
          <cite className="text-sm text-gray-400">- URUK 창립자</cite>
        </div>

        {/* Call to Action */}
        <div
          ref={(el) => (sectionRefs.current[storyParagraphs.length + 1] = el)}
          data-index={storyParagraphs.length + 1}
          className={`text-center mb-8 transition-opacity duration-1000 ${
            visibleSections.includes(storyParagraphs.length + 1) ? "opacity-100" : "opacity-0"
          }`}
        >
          <h3 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400 animate-gradient">
            URUK의 여정에 함께하세요
          </h3>
          <button className="mt-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-3 px-8 rounded-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-pink-600/30">
            로터리 참여하기
          </button>
        </div>
      </div>
    </PageLayout>
  )
}

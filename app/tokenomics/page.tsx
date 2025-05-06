"use client"

import { useState, useEffect } from "react"
import { PageLayout } from "@/components/page-layout"

export default function TokenomicsPage() {
  const [isChartVisible, setIsChartVisible] = useState(false)
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)

  const tokenDistribution = [
    { name: "팀", percentage: 30, color: "#FF5E8F" },
    { name: "커뮤니티", percentage: 25, color: "#9D4EDD" },
    { name: "리워드", percentage: 25, color: "#6A0DAD" },
    { name: "유동성", percentage: 10, color: "#3A0CA3" },
    { name: "예비비", percentage: 10, color: "#4361EE" },
  ]

  useEffect(() => {
    // Animate chart appearance on load
    const timer = setTimeout(() => {
      setIsChartVisible(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Calculate the SVG coordinates for each pie segment
  const createPieSegments = () => {
    const segments = []
    let cumulativePercentage = 0

    for (const item of tokenDistribution) {
      const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2
      cumulativePercentage += item.percentage
      const endAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2

      const startX = 100 + 80 * Math.cos(startAngle)
      const startY = 100 + 80 * Math.sin(startAngle)
      const endX = 100 + 80 * Math.cos(endAngle)
      const endY = 100 + 80 * Math.sin(endAngle)

      const largeArcFlag = item.percentage > 50 ? 1 : 0

      // Calculate a point slightly outside the circle for the hover effect
      const midAngle = (startAngle + endAngle) / 2
      const hoverX = hoveredSegment === item.name ? 100 + 85 * Math.cos(midAngle) : 100
      const hoverY = hoveredSegment === item.name ? 100 + 85 * Math.sin(midAngle) : 100

      segments.push({
        ...item,
        path: `M ${hoverX} ${hoverY} L ${startX} ${startY} A 80 80 0 ${largeArcFlag} 1 ${endX} ${endY} Z`,
        midAngle,
      })
    }

    return segments
  }

  const pieSegments = createPieSegments()

  return (
    <PageLayout>
      {/* Center the chart both vertically and horizontally */}
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        {/* Pie Chart Container */}
        <div className={`relative transition-opacity duration-1000 ${isChartVisible ? "opacity-100" : "opacity-0"}`}>
          {/* Floating particles around the chart */}
          <div className="absolute inset-0 -m-12 overflow-hidden pointer-events-none">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-gradient-to-r from-pink-500 to-purple-500 opacity-20 animate-pulse"
                style={{
                  width: `${Math.random() * 8 + 3}px`,
                  height: `${Math.random() * 8 + 3}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  filter: "blur(2px)",
                  animationDuration: `${Math.random() * 10 + 5}s`,
                  animationDelay: `${Math.random() * 5}s`,
                }}
              />
            ))}
          </div>

          {/* The pie chart */}
          <div className="relative w-64 h-64 md:w-80 md:h-80">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {pieSegments.map((segment, index) => (
                <path
                  key={index}
                  d={segment.path}
                  fill={segment.color}
                  stroke="#1a0028"
                  strokeWidth="1"
                  onMouseEnter={() => setHoveredSegment(segment.name)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    filter: hoveredSegment === segment.name ? `drop-shadow(0 0 10px ${segment.color})` : "none",
                    opacity: isChartVisible ? 1 : 0,
                    transition: `opacity 0.5s ease ${index * 0.1}s, filter 0.3s ease`,
                  }}
                />
              ))}
            </svg>

            {/* Glowing center circle with URUK label */}
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a0028] flex items-center justify-center"
              style={{
                width: "35%",
                height: "35%",
                boxShadow: "0 0 20px rgba(157, 78, 221, 0.6)",
              }}
            >
              <span className="text-white text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-gradient">
                URUK
              </span>
            </div>

            {/* Tooltip for segment information */}
            {hoveredSegment && (
              <div
                className="absolute top-0 left-0 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-sm pointer-events-none transition-opacity duration-200"
                style={{
                  transform: "translate(-50%, -100%)",
                  left: `${100 + 90 * Math.cos(pieSegments.find((s) => s.name === hoveredSegment)?.midAngle || 0)}px`,
                  top: `${100 + 90 * Math.sin(pieSegments.find((s) => s.name === hoveredSegment)?.midAngle || 0)}px`,
                }}
              >
                <div className="font-medium">{hoveredSegment}</div>
                <div>{tokenDistribution.find((item) => item.name === hoveredSegment)?.percentage}%</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

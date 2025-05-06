"use client"

import type { ReactNode } from "react"
import { Header } from "./header"
import { Footer } from "./footer"

interface PageLayoutProps {
  children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#1a0028] text-white overflow-hidden relative">
      {/* Background gradient effect */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-black/40 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at ${Math.random() * 100}% ${Math.random() * 100}%, rgba(120, 0, 255, 0.1), transparent)`,
        }}
      />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-pink-500 to-purple-500 opacity-20 animate-pulse"
            style={{
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              filter: "blur(2px)",
              animationDuration: `${Math.random() * 10 + 10}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <Header />
      <main className="flex-1 flex flex-col z-10 px-4 py-8 md:py-12 min-h-[calc(100vh-200px)]">{children}</main>
      <Footer />
    </div>
  )
}

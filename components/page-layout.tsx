"use client";

import type { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { useState, useEffect } from "react";

interface PageLayoutProps {
  children: ReactNode;
}

interface ParticleStyle {
  width: string;
  height: string;
  top: string;
  left: string;
  filter: string;
  animationDuration: string;
  animationDelay: string;
}

export function PageLayout({ children }: PageLayoutProps) {
  const [particleStyles, setParticleStyles] = useState<ParticleStyle[]>([]);
  const [gradientStyle, setGradientStyle] = useState<
    React.CSSProperties | undefined
  >(undefined);

  useEffect(() => {
    setGradientStyle({
      backgroundImage: `radial-gradient(circle at ${Math.random() * 100}% ${
        Math.random() * 100
      }%, rgba(120, 0, 255, 0.1), transparent)`,
    });

    const styles = Array(20)
      .fill(null)
      .map(() => ({
        width: `${Math.random() * 10 + 5}px`,
        height: `${Math.random() * 10 + 5}px`,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        filter: "blur(2px)",
        animationDuration: `${Math.random() * 15 + 10}s`,
        animationDelay: `${Math.random() * 10}s`,
      }));
    setParticleStyles(styles);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#1a0028] text-white overflow-hidden relative">
      {/* Background gradient effect */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-black/40 z-0"
        style={gradientStyle}
      />

      {/* Animated particles */}
      {particleStyles.length > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {particleStyles.map((style, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-gradient-to-r from-pink-500 to-purple-500 opacity-20 animate-drift"
              style={style}
            />
          ))}
        </div>
      )}

      <Header />
      <main className="flex-1 flex flex-col z-10 px-4 py-8 md:py-12 min-h-[calc(100vh-200px)]">
        {children}
      </main>
      <Footer />
    </div>
  );
}

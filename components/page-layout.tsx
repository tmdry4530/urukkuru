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

  // Value for top padding to accommodate header height (ensure Tailwind JIT compiler recognizes classes like py-16)
  // This value might need adjustment based on the actual header height.
  // Assuming current header py-2 is approx. 0.5rem * 2 = 1rem, plus logo height, etc., roughly 64px (4rem) => pt-16 (4rem)
  // Alternatively, the actual height could be calculated in the Header component and passed dynamically.
  const headerHeightPadding = "pt-16 md:pt-20"; // Mobile and desktop header heights might differ

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-purple-900/5 to-black">
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
      {/* Main content area with padding for header height + full width and centered */}
      <main className={`flex-grow relative z-10 w-full ${headerHeightPadding}`}>
        <div className="container mx-auto px-4">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

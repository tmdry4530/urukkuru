import type React from "react";
import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet-provider";
import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "react-hot-toast";

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "URUK - Web3 Lottery DApp",
  description: "URUK is a Web3 lottery DApp with a cyberpunk theme",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showComingSoonModal = false; // 이 값을 false로 바꾸면 모달이 사라집니다.

  if (showComingSoonModal) {
    return (
      <html lang="en">
        <body className={pixelifySans.className}>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "hsl(var(--background))",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              color: "white",
              textAlign: "center",
              padding: "20px",
              overflow: "hidden",
            }}
          >
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

            <div style={{ position: "relative", zIndex: 1 }}>
              <h1 style={{ fontSize: "4.5rem", marginBottom: "1rem" }}>
                COMING SOON
              </h1>
              <p style={{ fontSize: "1.8rem", marginBottom: "2rem" }}>
                Our website is currently under construction. We'll be back soon!
              </p>
              <p style={{ fontSize: "1.3rem" }}>Thank you for your patience.</p>
            </div>
          </div>
          {/* 모달이 활성화된 동안 기존 콘텐츠는 숨겨지거나 접근할 수 없게 됩니다. */}
          {/* <WalletProvider>{children}</WalletProvider> */}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={pixelifySans.className}>
        <WalletProvider>
          {children}
          <Toaster position="bottom-right" />
        </WalletProvider>
      </body>
    </html>
  );
}

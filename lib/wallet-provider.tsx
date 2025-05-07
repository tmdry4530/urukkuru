// lib/wallet-provider.tsx
"use client";

import { useEffect, useState } from "react";
import { createConfig, WagmiConfig, http } from "wagmi";
import { reconnect } from "wagmi/actions";
import { RainbowKitProvider, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { monadTestnet } from "./chain";

const queryClient = new QueryClient();

const { connectors } = getDefaultWallets({
  appName: "URUK Lottery",
  projectId: "12459f23e90abf2edb64bcd03d6e3799",
});

const wagmiConfig = createConfig({
  connectors,
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // 클라이언트 렌더링인지 확인
  const [mounted, setMounted] = useState(false);

  // 마운트 상태를 확인하여 hydration 이슈 방지
  useEffect(() => {
    setMounted(true);
  }, []);

  // 마운트 된 후에만 reconnect 실행
  useEffect(() => {
    if (mounted) {
      console.log("[WalletProvider] 컴포넌트 마운트됨, reconnect 시도...");

      // setTimeout을 사용하여 렌더링 주기 이후에 실행
      const timer = setTimeout(() => {
        reconnect(wagmiConfig)
          .then(() =>
            console.log("[WalletProvider] Reconnect 성공 또는 이미 연결됨")
          )
          .catch((error: Error) => {
            console.log(
              "[WalletProvider] Reconnect 중 오류 발생:",
              error.message
            );
          });
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [mounted]);

  // 클라이언트 사이드 렌더링 보장
  if (!mounted) {
    return null; // 서버 사이드 렌더링 또는 hydration 중에는 아무것도 렌더링하지 않음
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider locale="en-US">{children}</RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}

// lib/wallet-provider.tsx
"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    reconnect(wagmiConfig)
      .then(() =>
        console.log(
          "[WalletProvider] Reconnect attempt successful or wallet already connected."
        )
      )
      .catch((error: Error) => {
        console.log(
          "[WalletProvider] Reconnect attempt resulted in an error or was not needed:",
          error.message
        );
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}

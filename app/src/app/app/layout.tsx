import type { ReactNode } from "react";
import { WalletContextProvider } from "@/context/WalletContextProvider";

export default function AppSectionLayout({ children }: { children: ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}

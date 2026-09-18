import type { Metadata } from "next";
import { Newsreader, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/context/WalletContextProvider";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "ProofPay",
  description:
    "Payment held by a Solana program until the work is agreed done. If the two sides disagree, both file evidence and the ruling executes on-chain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${archivo.variable} ${jetbrains.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
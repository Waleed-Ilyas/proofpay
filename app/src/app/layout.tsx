import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display: Instrument Serif, a condensed, high-contrast serif with a real italic.
// Body/UI: Instrument Sans, same family lineage but clearly a different voice.
// Mono: JetBrains Mono, used only for hashes and wallet addresses.
const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: "400",
});

const description =
  "Payment held by a Solana program until the work is agreed done. If the two sides disagree, both file evidence and the ruling executes on-chain.";

export const metadata: Metadata = {
  title: "ProofPay: escrow where nobody holds the money",
  description,
  openGraph: {
    title: "ProofPay: escrow where nobody holds the money",
    description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#06151a",
  colorScheme: "dark",
};

// The wallet provider now lives in src/app/app/layout.tsx, so the landing page
// doesn't download the wallet adapters it never uses.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      {/* suppressHydrationWarning: browser extensions like Grammarly inject
          attributes (data-new-gr-c-s-check-loaded, data-gr-ext-installed)
          into <body> after the page loads. That's a real mismatch between
          server and client markup, but it's caused by the extension, not by
          this app, so React's warning about it is suppressed here. This only
          silences the warning for this one element; it does not hide other
          hydration mismatches. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

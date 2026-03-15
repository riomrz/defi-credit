import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "DefiCredit — Decentralized Credit on IOTA",
  description: "Portable, self-sovereign credit profiles powered by IOTA Identity",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark" suppressHydrationWarning>
      <body className="bg-dc-surface text-dc antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

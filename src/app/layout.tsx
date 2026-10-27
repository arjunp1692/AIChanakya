import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Gujarati } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
const notoGuj = Noto_Sans_Gujarati({ subsets: ["gujarati"], variable: "--font-guj", display: "swap" });

export const metadata: Metadata = {
  title: "Chanakya AI",
  description: "CEO Office task and ticket system for Kubera Now",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", noto.variable, notoGuj.variable)}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

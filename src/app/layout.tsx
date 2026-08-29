import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalLayout } from "@/components/conditional-layout";
import { ToastProvider } from "@/components/ui/toast/toast-context";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Hermy HQ",
  description: "Your command center",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} ${geist.className} bg-[var(--bg)] text-[var(--foreground)] min-h-screen`}>
        <ToastProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </ToastProvider>
      </body>
    </html>
  );
}

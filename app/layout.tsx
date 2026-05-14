import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "C1V1 = C2V2 Solver",
  description: "Dilution equation solver",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

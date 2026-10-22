import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kalsi | People & Payroll",
  description:
    "Monthly salary slips, made simple. HR workspace for Kalsi Buildcon.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

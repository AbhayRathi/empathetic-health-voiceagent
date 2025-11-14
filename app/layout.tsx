import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empathetic Health Voice Agent",
  description: "HIPAA-compliant voice-intake system for healthcare",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

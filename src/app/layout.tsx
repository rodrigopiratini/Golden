import type { Metadata } from "next";
import { Inter, Saira } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const saira = Saira({ subsets: ["latin"], variable: "--font-saira", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Golden CRM", template: "%s · Golden CRM" },
  description: "Gestão de contatos, campanhas de WhatsApp e catálogo — Golden Artefatos de Madeira",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${saira.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lucent News",
  description: "Balanced news coverage, powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolageGrotesque.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#7b6efa",
              colorBackground: "#0f1219",
              colorInput: "#161c2e",
              colorInputForeground: "#e8ecf8",
              colorForeground: "#e8ecf8",
              colorMutedForeground: "#3a4468",
              colorNeutral: "#e8ecf8",
              borderRadius: "10px",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

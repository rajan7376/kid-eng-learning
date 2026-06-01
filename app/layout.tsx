import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "兒童美語互動單字本",
  description: "AI 自動生成單字卡，孩子練發音與聽力測驗",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);

  return (
    <html lang="zh-Hant">
      <body className="font-rounded">
        <NavBar
          session={session ? { role: session.role, name: session.name } : null}
        />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

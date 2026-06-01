import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import AccountMenu from "@/components/AccountMenu";
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
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-violet-100">
          <nav className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-extrabold text-brand">
              🦊 美語單字本
            </Link>
            <div className="flex items-center gap-4 text-sm font-bold">
              {session ? (
                <>
                  <Link href="/study" className="hover:text-brand">
                    學習
                  </Link>
                  {session.role === "admin" && (
                    <Link href="/admin" className="hover:text-brand">
                      管理後台
                    </Link>
                  )}
                  <AccountMenu name={session.name} />
                </>
              ) : (
                <Link href="/login" className="hover:text-brand">
                  登入
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

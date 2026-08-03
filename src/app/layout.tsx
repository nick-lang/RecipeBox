import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RecipeBox",
  description:
    "Snap a photo of a recipe card and share it in your group's cookbook.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
            <Link href={user ? "/dashboard" : "/"} className="font-bold">
              🍲 RecipeBox
            </Link>
            {user ? (
              <form action="/auth/signout" method="post">
                <button className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="text-sm font-medium">
                Sign in
              </Link>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

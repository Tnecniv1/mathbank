// src/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import SignOutButton from "@/components/signout-button";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => { try { cookieStore.set(name, value, options as any); } catch {} },
        remove: (name, options) => { try { cookieStore.set(name, "", { ...(options as any), maxAge: 0 }); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="fr">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="w-full border-b bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* Navigation : uniquement Maison */}
            <nav className="flex items-center gap-4">
              <Link href="/" className="font-semibold hover:underline">Maison</Link>
            </nav>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden sm:inline text-sm text-neutral-600">{user.email}</span>
                  <SignOutButton />
                </>
              ) : (
                <Link href="/auth" className="text-sm underline">Se connecter</Link>
              )}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}



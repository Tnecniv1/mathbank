// src/app/layout.tsx
import"./globals.css";
import Link from"next/link";
import { ReactNode } from"react";
import { cookies } from"next/headers";
import { createServerClient } from"@supabase/ssr";
import SignOutButton from"@/components/signout-button";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
 const cookieStore = await cookies();
 const supabase = createServerClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 {
 cookies: {
 get: (name) => cookieStore.get(name)?.value,
 set: (name, value, options) => { try { cookieStore.set(name, value, options as any); } catch {} },
 remove: (name, options) => { try { cookieStore.set(name,"", { ...(options as any), maxAge: 0 }); } catch {} },
 },
 }
 );
 const { data: { user } } = await supabase.auth.getUser();

 let displayName: string | null = null;
 let avatarUrl: string | null = null;
 let initiales = '?';
 if (user) {
  const { data: profile } = await supabase
   .from('profiles')
   .select('pseudo, avatar_url')
   .eq('user_id', user.id)
   .single();
  displayName = profile?.pseudo || user.email || null;
  avatarUrl = profile?.avatar_url || null;
  initiales = displayName
   ? displayName.trim().split(/\s+/).map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
   : '?';
 }

 return (
 <html lang="fr">
 <body className="min-h-screen bg-cream-100 text-ink">
 <header className="w-full border-b border-border bg-cream-50">
 <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
 {/* Navigation : uniquement Maison */}
 <nav className="flex items-center gap-4">
 <Link href="/" className="font-semibold text-ink hover:text-accent transition-colors">Maison</Link>
 </nav>
 <div className="flex items-center gap-3">
 {user ? (
 <>
 <div className="hidden sm:flex items-center gap-2">
  {avatarUrl ? (
   // eslint-disable-next-line @next/next/no-img-element
   <img src={avatarUrl} alt={initiales} className="w-8 h-8 rounded-full object-cover shrink-0" />
  ) : (
   <div className="w-8 h-8 rounded-full bg-[#185FA5] text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
    {initiales}
   </div>
  )}
  <span className="text-base text-ink-light">{displayName}</span>
 </div>
 <SignOutButton />
 </>
 ) : (
 <Link href="/auth" className="text-base text-accent hover:underline">Se connecter</Link>
 )}
 </div>
 </div>
 </header>
 {children}
 </body>
 </html>
 );
}



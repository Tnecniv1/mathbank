"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let stop = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !stop) {
        router.replace("/auth");  // pas connecté → on envoie vers /auth
        return;
      }
      if (!stop) setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/auth");
    });

    return () => {
      stop = true;
      sub?.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return <div className="min-h-screen grid place-items-center">Chargement…</div>;
  }
  return <>{children}</>;
}

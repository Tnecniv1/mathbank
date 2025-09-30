"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-3 py-1.5 rounded-xl border shadow text-sm"
      aria-label="Se déconnecter"
    >
      Se déconnecter
    </button>
  );
}


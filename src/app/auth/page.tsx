"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/atelier");
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">
          {mode === "signup" ? "Inscription" : "Connexion"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border rounded-xl p-3"
          />
          <input
            type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full border rounded-xl p-3"
          />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl shadow bg-black text-white disabled:opacity-50"
          >
            {loading ? "..." : (mode === "signup" ? "Créer mon compte" : "Se connecter")}
          </button>
        </form>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-sm underline"
          >
            {mode === "signup" ? "Déjà un compte ? Connexion" : "Nouveau ? Inscription"}
          </button>

          <button
            onClick={handleSignOut}
            className="text-sm underline"
          >
            Se déconnecter
          </button>
        </div>

        <div className="text-center">
          <a href="/" className="text-sm underline">← Retour Maison</a>
        </div>
      </div>
    </main>
  );
}

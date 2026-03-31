"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
 const [mode, setMode] = useState<"login" | "signup">("login");
 const router = useRouter();

 // Login
 const [loginIdentifier, setLoginIdentifier] = useState("");
 const [loginPassword, setLoginPassword] = useState("");

 // Signup
 const [pseudo, setPseudo] = useState("");
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Connexion — supporte email ou pseudo
 async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);
  try {
   let email: string;
   if (loginIdentifier.includes("@")) {
    email = loginIdentifier;
   } else {
    const { data: found, error: rpcError } = await supabase.rpc("get_email_by_pseudo", {
     pseudo: loginIdentifier,
    });
    if (rpcError) throw rpcError;
    if (!found) { setError("Pseudo introuvable"); setLoading(false); return; }
    email = found as string;
   }
   const { error } = await supabase.auth.signInWithPassword({ email, password: loginPassword });
   if (error) throw error;
   router.push("/");
   router.refresh();
  } catch (e: any) {
   setError(e.message ?? "Identifiant ou mot de passe incorrect");
  } finally {
   setLoading(false);
  }
 }

 // Inscription — pseudo uniquement
 async function handleSignup(e: React.FormEvent) {
  e.preventDefault();
  setError(null);

  if (!pseudo.trim()) { setError("Le pseudo est requis"); return; }
  if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères"); return; }
  if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); return; }

  setLoading(true);
  try {
   const email = `${pseudo.trim().toLowerCase()}@mathbank.internal`;

   const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
   });
   if (signUpError) throw signUpError;
   if (!authData.user) throw new Error("Erreur lors de la création du compte");

   // Upsert du profil avec le pseudo
   await supabase
    .from("profiles")
    .upsert(
     { user_id: authData.user.id, pseudo: pseudo.trim(), profil_complet: false },
     { onConflict: "user_id" }
    );

   router.push("/");
   router.refresh();
  } catch (e: any) {
   setError(e.message ?? "Erreur lors de l'inscription");
  } finally {
   setLoading(false);
  }
 }

 const inputCls =
  "w-full border border-border rounded-lg p-3 bg-cream-50 text-ink focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
 const btnCls =
  "w-full px-4 py-3 rounded-lg shadow-sm bg-accent hover:bg-accent-hover text-ink font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all";

 return (
  <main className="min-h-screen flex items-center justify-center p-6 bg-cream-100">
   <div className="w-full max-w-md space-y-6 bg-cream-50 p-8 rounded-lg shadow-sm border border-border">
    <div>
     <h1 className="text-3xl font-bold text-center text-ink">
      {mode === "signup" ? "Créer un compte" : "Connexion"}
     </h1>
     <p className="text-center text-sm text-ink-muted mt-2">
      {mode === "signup"
       ? "Choisis un pseudo et un mot de passe"
       : "Connecte-toi avec ton pseudo ou email"}
     </p>
    </div>

    {error && (
     <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <p className="text-red-600 text-sm">{error}</p>
     </div>
    )}

    {/* Connexion */}
    {mode === "login" && (
     <form onSubmit={handleLogin} className="space-y-4">
      <div>
       <label htmlFor="loginIdentifier" className="block text-sm font-medium text-ink mb-1">
        Email ou pseudo
       </label>
       <input
        id="loginIdentifier"
        type="text"
        required
        value={loginIdentifier}
        onChange={(e) => setLoginIdentifier(e.target.value)}
        placeholder="votre@email.com ou Max_"
        className={inputCls}
       />
      </div>
      <div>
       <label htmlFor="loginPassword" className="block text-sm font-medium text-ink mb-1">
        Mot de passe
       </label>
       <input
        id="loginPassword"
        type="password"
        required
        value={loginPassword}
        onChange={(e) => setLoginPassword(e.target.value)}
        placeholder="••••••••"
        className={inputCls}
       />
      </div>
      <button type="submit" disabled={loading} className={btnCls}>
       {loading ? "Connexion..." : "Se connecter"}
      </button>
     </form>
    )}

    {/* Inscription */}
    {mode === "signup" && (
     <form onSubmit={handleSignup} className="space-y-4">
      <div>
       <label htmlFor="pseudo" className="block text-sm font-medium text-ink mb-1">
        Pseudo <span className="text-red-500">*</span>
       </label>
       <input
        id="pseudo"
        type="text"
        required
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value)}
        placeholder="monpseudo"
        className={inputCls}
       />
      </div>
      <div>
       <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
        Mot de passe <span className="text-red-500">*</span>
       </label>
       <input
        id="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className={inputCls}
       />
      </div>
      <div>
       <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
        Confirmer le mot de passe <span className="text-red-500">*</span>
       </label>
       <input
        id="confirmPassword"
        type="password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        className={inputCls}
       />
      </div>
      <button type="submit" disabled={loading} className={btnCls}>
       {loading ? "Création du compte..." : "S'inscrire"}
      </button>
     </form>
    )}

    <div className="flex items-center justify-center pt-4 border-t border-border">
     <button
      onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }}
      className="text-sm text-accent hover:underline font-medium"
     >
      {mode === "signup" ? "Déjà un compte ? Connexion" : "Nouveau ? Inscription"}
     </button>
    </div>
   </div>
  </main>
 );
}

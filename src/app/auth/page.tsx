"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "parent" | "student" | "teacher";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();

  // États pour la connexion
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // États pour l'inscription
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "", // NOUVEAU
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    city: "",
    postalCode: "",
    role: "" as UserRole | "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Validation du formulaire d'inscription
  const validateSignupForm = () => {
    if (!signupData.firstName || !signupData.lastName) {
      setError("Nom et prénom sont requis");
      return false;
    }
    if (!signupData.birthDate) {
      setError("Date de naissance est requise");
      return false;
    }
    if (!signupData.email) {
      setError("Email est requis");
      return false;
    }
    if (signupData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return false;
    }
    if (signupData.password !== signupData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return false;
    }
    if (!signupData.city) {
      setError("La ville est requise");
      return false;
    }
    if (!signupData.role) {
      setError("Veuillez sélectionner votre profil");
      return false;
    }
    return true;
  };

  // Gestion de la connexion
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  // Gestion de l'inscription
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    // Validation
    if (!validateSignupForm()) {
      setLoading(false);
      return;
    }

    try {
      // 1. Créer le compte utilisateur dans auth.users
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: `${signupData.firstName} ${signupData.lastName}`,
            first_name: signupData.firstName,
            last_name: signupData.lastName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Erreur lors de la création du compte");

      // 2. Mettre à jour le profil avec les informations supplémentaires
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: `${signupData.firstName} ${signupData.lastName}`,
          preferences: {
            first_name: signupData.firstName,
            last_name: signupData.lastName,
            birth_date: signupData.birthDate, // NOUVEAU
            address: signupData.address,
            city: signupData.city,
            postal_code: signupData.postalCode,
            role: signupData.role,
          },
        })
        .eq("user_id", authData.user.id);

      if (profileError) {
        console.error("Erreur lors de la mise à jour du profil:", profileError);
        // Ne pas bloquer l'inscription si la mise à jour du profil échoue
      }

      // Succès
      setSuccess("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
      
      // Réinitialiser le formulaire et passer en mode connexion
      setSignupData({
        firstName: "",
        lastName: "",
        birthDate: "",
        email: "",
        password: "",
        confirmPassword: "",
        address: "",
        city: "",
        postalCode: "",
        role: "",
      });
      
      // Basculer vers le mode connexion après 2 secondes
      setTimeout(() => {
        setMode("login");
        setLoginEmail(signupData.email);
        setSuccess(null);
      }, 2000);
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  // Gestion de la déconnexion
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl space-y-6 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">
            {mode === "signup" ? "Créer un compte" : "Connexion"}
          </h1>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
            {mode === "signup"
              ? "Remplissez le formulaire pour vous inscrire"
              : "Connectez-vous à votre compte"}
          </p>
        </div>

        {/* Messages d'erreur et de succès */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>
          </div>
        )}

        {/* Formulaire de connexion */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="loginEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                id="loginEmail"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="loginPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mot de passe
              </label>
              <input
                id="loginPassword"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        )}

        {/* Formulaire d'inscription */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Nom et Prénom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={signupData.firstName}
                  onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                  placeholder="Jean"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={signupData.lastName}
                  onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                  placeholder="Dupont"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Date de naissance - NOUVEAU */}
            <div>
              <label htmlFor="birthDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date de naissance <span className="text-red-500">*</span>
              </label>
              <input
                id="birthDate"
                type="date"
                required
                value={signupData.birthDate}
                onChange={(e) => setSignupData({ ...signupData, birthDate: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                placeholder="vous@exemple.com"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Mot de passe et confirmation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirmer <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Adresse (optionnel)
              </label>
              <input
                id="address"
                type="text"
                value={signupData.address}
                onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                placeholder="123 rue de la Paix"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Ville et Code postal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={signupData.city}
                  onChange={(e) => setSignupData({ ...signupData, city: e.target.value })}
                  placeholder="Paris"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Code postal (optionnel)
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={signupData.postalCode}
                  onChange={(e) => setSignupData({ ...signupData, postalCode: e.target.value })}
                  placeholder="75001"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Profil utilisateur */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Je suis <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label
                  className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    signupData.role === "parent"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-300 dark:border-slate-700 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="parent"
                    checked={signupData.role === "parent"}
                    onChange={(e) => setSignupData({ ...signupData, role: e.target.value as UserRole })}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="text-2xl mb-1">👨‍👩‍👧‍👦</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Un parent</div>
                  </div>
                </label>

                <label
                  className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    signupData.role === "student"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-300 dark:border-slate-700 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={signupData.role === "student"}
                    onChange={(e) => setSignupData({ ...signupData, role: e.target.value as UserRole })}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎓</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Un étudiant</div>
                  </div>
                </label>

                <label
                  className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    signupData.role === "teacher"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-300 dark:border-slate-700 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="teacher"
                    checked={signupData.role === "teacher"}
                    onChange={(e) => setSignupData({ ...signupData, role: e.target.value as UserRole })}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="text-2xl mb-1">👨‍🏫</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Un professeur</div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Création du compte..." : "Créer mon compte"}
            </button>
          </form>
        )}

        {/* Bascule connexion/inscription */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
              setSuccess(null);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {mode === "signup" ? "Déjà un compte ? Connexion" : "Nouveau ? Inscription"}
          </button>

          <button
            onClick={handleSignOut}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          >
            Se déconnecter
          </button>
        </div>

        {/* Retour accueil */}
        <div className="text-center pt-4">
          <a
            href="/"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium inline-flex items-center gap-2"
          >
            <span>←</span> Retour à l'accueil
          </a>
        </div>
      </div>
    </main>
  );
}
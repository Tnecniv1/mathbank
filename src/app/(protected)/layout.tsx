// src/app/(protected)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProfileCompletionModal from "./_components/ProfileCompletionModal";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) redirect("/auth?redirectTo=/atelier");

 // Vérification profil complet (server-side, bypass RLS via cookie session)
 const { data: profile } = await supabase
  .from("profiles")
  .select("profil_complet")
  .eq("user_id", user.id)
  .single();

 const profilComplet = profile?.profil_complet ?? false;

 return (
  <>
   {children}
   {!profilComplet && <ProfileCompletionModal />}
  </>
 );
}

// src/app/(protected)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirectTo=/atelier");
  return <>{children}</>;
}

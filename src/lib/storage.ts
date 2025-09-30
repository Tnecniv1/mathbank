// src/lib/storage.ts
// Helpers Supabase côté **client** pour un site statique (Next export).
// ⚠️ N'utiliser que les clés publiques (NEXT_PUBLIC_*)

import { createClient } from "@supabase/supabase-js";

// -- CONFIG ---------------------------------------------------------------
// Adapte le nom du bucket si nécessaire
const DEFAULT_BUCKET = "pdfs"; // ← change en fonction de ton bucket

// Instanciation client (clé anonyme publique uniquement)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// -- TYPES ---------------------------------------------------------------
export type SignedUrlOptions = {
  expiresIn?: number; // en secondes (défaut: 60s)
};

// -- URLS SIGNÉES --------------------------------------------------------
export async function getSignedPdfUrl(
  path: string,
  options: SignedUrlOptions = {}
): Promise<string | null> {
  const expiresIn = options.expiresIn ?? 60;
  const { data, error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

/** Générique si tu veux signer autre chose que des PDFs */
export async function getSignedUrl(
  bucket: string,
  path: string,
  options: SignedUrlOptions = {}
): Promise<string | null> {
  const expiresIn = options.expiresIn ?? 60;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// -- URL PUBLIQUE (si le bucket est public) ------------------------------
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// -- UPLOADS (client) ----------------------------------------------------
/**
 * Upload d'un fichier dans un bucket public/protégé avec la clé anonyme.
 * Note: respecte tes RLS policies côté Supabase.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  opts?: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
  }
): Promise<{ path: string }> {
  const { error, data } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: opts?.upsert ?? false,
    contentType: opts?.contentType ?? file.type,
    cacheControl: opts?.cacheControl ?? "3600",
  });
  if (error) throw error;
  return { path: data?.path ?? path };
}

// -- LIST & DELETE -------------------------------------------------------
export async function listFiles(
  bucket: string,
  prefix = "",
  limit = 100
): Promise<import("@supabase/storage-js").FileObject[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  return data ?? [];
}

export async function deleteFiles(bucket: string, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

// -- PETITS PLUS ---------------------------------------------------------
/** Ajoute un cache-buster à une URL signée (utile si l'image/PDF change souvent) */
export function withCacheBuster(url: string): string {
  const u = new URL(url);
  u.searchParams.set("_", Date.now().toString());
  return u.toString();
}

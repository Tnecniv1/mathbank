import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold">Maison</h1>
        <p className="text-gray-600">Bienvenue dans la banque d'exercices.</p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/library"
            className="px-4 py-2 rounded-xl shadow bg-black text-white"
          >
            Bibliothèque
          </Link>

          <Link
            href="/admin/entrainements/ajouter"
            className="px-4 py-2 rounded-xl shadow bg-blue-600 text-white"
          >
            Admin - Ajouter un entraînement
          </Link>

          <Link
            href="/admin/cours"
            className="px-4 py-2 rounded-xl shadow bg-teal-600 text-white"
          >
            Admin - Ajouter un cours
          </Link>

          <Link
            href="/admin/scope"
            className="px-4 py-2 rounded-xl shadow bg-purple-600 text-white"
          >
            Admin - Gérer le Scope
          </Link>
        </div>
      </div>
    </main>
  );
}

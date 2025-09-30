import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold">Maison</h1>
        <p className="text-gray-600">Bienvenue dans la banque d’exercices.</p>

        <div className="flex gap-3 justify-center">
          <Link
            href="/library"
            className="px-4 py-2 rounded-xl shadow bg-black text-white"
          >
            Bibliothèque
          </Link>

          <Link
            href="/atelier"
            className="px-4 py-2 rounded-xl shadow border"
          >
            Atelier
          </Link>
        </div>
      </div>
    </main>
  );
}

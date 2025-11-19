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
            className="px-4 py-2 rounded-xl shadow bg-black text-white hover:bg-gray-800 transition-colors"
          >
            Bibliothèque
          </Link>

          <Link
            href="/progression"
            className="px-4 py-2 rounded-xl shadow bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            Progression
          </Link>

          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl shadow bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Administration
          </Link>
        </div>
      </div>
    </main>
  );
}
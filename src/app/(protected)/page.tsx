import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-3">
            🏠 Maison
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Bienvenue dans la banque d'exercices de mathématiques
          </p>
        </div>

        {/* Grille de navigation */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Bibliothèque */}
          <Link
            href="/library"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">📚</div>
            <h2 className="text-xl font-bold mb-2">Bibliothèque</h2>
            <p className="text-slate-300 text-sm">
              Accédez aux feuilles d'entraînement et suivez votre parcours
            </p>
          </Link>

          {/* Progression */}
          <Link
            href="/progression"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">📊</div>
            <h2 className="text-xl font-bold mb-2">Progression</h2>
            <p className="text-purple-100 text-sm">
              Consultez vos statistiques et votre évolution
            </p>
          </Link>

          {/* Classement */}
          <Link
            href="/classement"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">🏆</div>
            <h2 className="text-xl font-bold mb-2">Classement</h2>
            <p className="text-blue-100 text-sm">
              Comparez vos performances et créez votre équipe
            </p>
          </Link>

          {/* Personnel */}
          <Link
            href="/personnel"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">👤</div>
            <h2 className="text-xl font-bold mb-2">Personnel</h2>
            <p className="text-green-100 text-sm">
              Gérez votre équipe et vos notifications
            </p>
          </Link>

          {/* Administration */}
          <Link
            href="/admin"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-teal-600 to-teal-700 dark:from-teal-700 dark:to-teal-800 text-white hover:shadow-xl hover:scale-105 transition-all duration-200 md:col-span-2"
          >
            <div className="text-4xl mb-3">⚙️</div>
            <h2 className="text-xl font-bold mb-2">Administration</h2>
            <p className="text-teal-100 text-sm">
              Gérez les niveaux, sujets, chapitres et feuilles d'entraînement
            </p>
          </Link>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400 pt-4">
          <p>Système d'apprentissage collaboratif avec équipes et validation</p>
        </div>
      </div>
    </main>
  );
}
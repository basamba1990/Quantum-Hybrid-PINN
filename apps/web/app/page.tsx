import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">SpotBulle Science Verify</h1>
        <p className="text-gray-600 mb-8">
          Gestion complète de projets, analyses et rapports scientifiques
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/auth/login"
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Se connecter
        </Link>
        <Link
          href="/dashboard"
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Dashboard
        </Link>
      </div>
    </div>
  )
}
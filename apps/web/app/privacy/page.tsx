import React from 'react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Politique de Confidentialité</h1>
        <p className="mb-4 text-sm">Dernière mise à jour : 04 Juillet 2026</p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Collecte des données</h2>
          <p>Nous collectons les informations que vous nous fournissez lors de la création de votre compte (nom, email) et les données relatives à vos simulations.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Utilisation des données</h2>
          <p>Vos données sont utilisées pour fournir le service de simulation, traiter vos paiements via Paddle, et améliorer nos algorithmes de calcul.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Protection des données</h2>
          <p>Nous mettons en œuvre des mesures de sécurité robustes pour protéger vos données contre tout accès non autorisé. Vos données de simulation sont confidentielles.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Partage avec des tiers</h2>
          <p>Nous ne vendons pas vos données. Nous partageons uniquement les informations nécessaires avec nos prestataires de services (ex: Paddle pour les paiements, Supabase pour le stockage).</p>
        </section>

        <footer className="mt-12 pt-8 border-t border-slate-800">
          <p>Pour toute question : basamba1990@yahoo.fr</p>
        </footer>
      </div>
    </div>
  )
}

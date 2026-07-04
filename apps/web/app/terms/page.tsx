import React from 'react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Conditions d'Utilisation</h1>
        <p className="mb-4 text-sm">Dernière mise à jour : 04 Juillet 2026</p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Acceptation des conditions</h2>
          <p>En accédant et en utilisant Quantum-Hybrid PINN, vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Description du service</h2>
          <p>Quantum-Hybrid PINN fournit une plateforme SaaS de simulation industrielle basée sur les Physics-Informed Neural Networks (PINN). Le service inclut l'accès à des outils de calcul, de visualisation 3D et d'audit scientifique.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Abonnements et Paiements</h2>
          <p>L'accès aux fonctionnalités Premium nécessite un abonnement payant. Les paiements sont traités par notre partenaire Paddle. Vous acceptez de fournir des informations de paiement exactes et à jour.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Propriété intellectuelle</h2>
          <p>Tous les contenus, algorithmes et logiciels présents sur la plateforme sont la propriété exclusive de Quantum-Hybrid PINN ou de ses concédants de licence.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">5. Limitation de responsabilité</h2>
          <p>Bien que nous nous efforcions de fournir des simulations précises, Quantum-Hybrid PINN ne peut être tenu responsable des décisions industrielles prises sur la base des résultats de la plateforme sans validation expérimentale complémentaire.</p>
        </section>

        <footer className="mt-12 pt-8 border-t border-slate-800">
          <p>Contact : basamba1990@yahoo.fr</p>
        </footer>
      </div>
    </div>
  )
}

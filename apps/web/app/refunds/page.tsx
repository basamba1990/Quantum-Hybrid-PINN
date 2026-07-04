import React from 'react'

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Politique de Remboursement</h1>
        <p className="mb-4 text-sm">Dernière mise à jour : 04 Juillet 2026</p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Abonnements mensuels</h2>
          <p>Compte tenu de la nature numérique de nos services et de la puissance de calcul allouée immédiatement, les abonnements mensuels ne sont généralement pas remboursables une fois l'accès activé.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Droit de rétractation</h2>
          <p>Conformément aux réglementations sur les services numériques, vous disposez d'un droit de rétractation de 14 jours, à condition qu'aucune simulation n'ait été lancée durant cette période.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Problèmes techniques</h2>
          <p>Si vous rencontrez un problème technique majeur empêchant l'utilisation du service, nous nous engageons à le résoudre ou à vous proposer un crédit compensatoire.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Annulation</h2>
          <p>Vous pouvez annuler votre abonnement à tout moment. L'accès aux fonctionnalités Premium restera actif jusqu'à la fin de la période de facturation en cours.</p>
        </section>

        <footer className="mt-12 pt-8 border-t border-slate-800">
          <p>Contact Support : basamba1990@yahoo.fr</p>
        </footer>
      </div>
    </div>
  )
}

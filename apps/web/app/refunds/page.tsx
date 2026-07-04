import React from 'react'

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Politique de Remboursement</h1>
        <p className="mb-8 text-sm text-slate-400">Dernière mise à jour : 04 Juillet 2026</p>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <p className="mb-4">Chez Quantum-Hybrid PINN, nous nous engageons à offrir un service de haute qualité. Cette Politique de Remboursement décrit les conditions dans lesquelles des remboursements peuvent être accordés pour les abonnements à notre plateforme SaaS.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Généralités</h2>
            <p>Tous les abonnements à Quantum-Hybrid PINN sont gérés par notre partenaire de paiement tiers, Paddle. Les demandes de remboursement seront traitées conformément aux présentes conditions et aux politiques de Paddle.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Période de Remboursement</h2>
            <p>Nous offrons une garantie de remboursement de <strong>14 jours</strong> à compter de la date de souscription initiale à tout nouvel abonnement payant. Si vous n'êtes pas entièrement satisfait de notre Service pendant cette période, vous pouvez demander un remboursement complet.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Conditions d'Éligibilité au Remboursement</h2>
            <p>Pour être éligible à un remboursement :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li>La demande doit être effectuée dans les 14 jours suivant la date de souscription initiale.</li>
              <li>Cette politique s'applique uniquement aux <strong>nouveaux abonnements</strong>. Les renouvellements d'abonnement ne sont généralement pas éligibles à un remboursement, sauf en cas de circonstances exceptionnelles et à notre discrétion.</li>
              <li>Le compte ne doit pas avoir enfreint nos Conditions d'Utilisation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Processus de Demande de Remboursement</h2>
            <p>Pour demander un remboursement, veuillez suivre les étapes suivantes :</p>
            <ol className="list-decimal list-inside space-y-2 mt-4 text-slate-300">
              <li>Contactez notre support client à l'adresse e-mail : <a href="mailto:basamba1990@yahoo.fr" className="text-blue-400 hover:text-blue-300">basamba1990@yahoo.fr</a></li>
              <li>Dans votre e-mail, veuillez inclure les informations suivantes :
                <ul className="list-disc list-inside space-y-1 mt-2 ml-4">
                  <li>Votre nom complet et l'adresse e-mail associée à votre compte Quantum-Hybrid PINN.</li>
                  <li>La date de votre souscription.</li>
                  <li>La raison de votre demande de remboursement (cela nous aide à améliorer notre service).</li>
                </ul>
              </li>
              <li>Notre équipe examinera votre demande et vous répondra dans un délai de 5 jours ouvrables.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">5. Traitement du Remboursement</h2>
            <p>Si votre demande de remboursement est approuvée :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li>Le remboursement sera traité via Paddle et crédité sur le mode de paiement original utilisé lors de l'achat.</li>
              <li>Le délai de traitement peut varier en fonction de votre institution financière, mais il faut généralement compter entre 5 et 10 jours ouvrables pour que le remboursement apparaisse sur votre relevé.</li>
              <li>L'accès à votre abonnement payant sera révoqué dès que le remboursement sera traité.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">6. Non-Éligibilité au Remboursement</h2>
            <p>Les situations suivantes ne sont généralement pas éligibles à un remboursement :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li>Demandes effectuées après la période de garantie de 14 jours.</li>
              <li>Renouvellements d'abonnement.</li>
              <li>Abonnements annulés après la période de 14 jours (l'accès au service sera maintenu jusqu'à la fin de la période de facturation en cours, mais aucun remboursement partiel ne sera émis).</li>
              <li>Achats effectués via des promotions spéciales ou des offres non remboursables (si spécifié au moment de l'achat).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">7. Modifications de cette Politique</h2>
            <p>Nous nous réservons le droit de modifier cette Politique de Remboursement à tout moment. Toute modification sera effective dès sa publication sur notre site web. Nous vous encourageons à consulter régulièrement cette page pour rester informé de nos politiques.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">8. Contact</h2>
            <p>Pour toute question concernant notre Politique de Remboursement, veuillez nous contacter à : <a href="mailto:basamba1990@yahoo.fr" className="text-blue-400 hover:text-blue-300">basamba1990@yahoo.fr</a></p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-400 text-sm">© 2026 Quantum-Hybrid PINN. Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  )
}

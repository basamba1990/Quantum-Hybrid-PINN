import React from 'react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Conditions d'Utilisation</h1>
        <p className="mb-8 text-sm text-slate-400">Dernière mise à jour : 04 Juillet 2026</p>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Acceptation des Conditions</h2>
            <p>En vous inscrivant, en accédant ou en utilisant la plateforme Quantum-Hybrid PINN (le "Service"), vous reconnaissez avoir lu, compris et accepté d'être lié par ces Conditions d'Utilisation, ainsi que par notre Politique de Confidentialité. Si vous n'acceptez pas ces conditions, vous n'êtes pas autorisé à utiliser le Service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Description du Service</h2>
            <p>Quantum-Hybrid PINN fournit une suite d'outils et de services basés sur les Physics-Informed Neural Networks (PINN) et les Fourier Neural Operators (FNO) pour la simulation et l'analyse de systèmes complexes de dynamique des fluides industriels, notamment ceux impliquant l'hydrogène. Le Service inclut, sans s'y limiter :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li><strong>Simulations Avancées :</strong> Accès à des moteurs de simulation hybrides IA-physique pour des calculs rapides et précis.</li>
              <li><strong>Visualisation 3D :</strong> Outils interactifs pour l'exploration des résultats de simulation en trois dimensions.</li>
              <li><strong>Audit Scientifique :</strong> Fonctionnalités d'évaluation de la crédibilité et de validation physique des modèles.</li>
              <li><strong>API et Intégrations :</strong> Interfaces pour l'intégration avec des systèmes tiers et des flux de travail industriels.</li>
            </ul>
            <p className="mt-4">Le Service est conçu pour aider les ingénieurs, les chercheurs et les entreprises à prendre des décisions éclairées, mais ne remplace pas l'expertise humaine ni les validations expérimentales.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Accès et Comptes Utilisateur</h2>
            <p>Pour accéder à certaines fonctionnalités du Service, vous devrez créer un compte. Vous êtes responsable de maintenir la confidentialité de vos informations de connexion et de toutes les activités qui se produisent sous votre compte. Vous acceptez de nous informer immédiatement de toute utilisation non autorisée de votre compte.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Abonnements et Paiements</h2>
            <p>L'accès aux fonctionnalités complètes de Quantum-Hybrid PINN est soumis à un abonnement payant. Les détails des plans d'abonnement, les tarifs et les modalités de paiement sont disponibles sur notre page de tarification. Tous les paiements sont traités par notre partenaire tiers, Paddle. En souscrivant à un abonnement, vous autorisez Paddle à débiter les frais applicables via le mode de paiement que vous avez choisi. Les abonnements sont renouvelés automatiquement sauf annulation préalable.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">5. Utilisation Acceptable</h2>
            <p>Vous acceptez de ne pas utiliser le Service pour :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li>Toute activité illégale ou frauduleuse.</li>
              <li>Violer les droits de propriété intellectuelle de Quantum-Hybrid PINN ou de tiers.</li>
              <li>Interférer avec le fonctionnement du Service ou les serveurs et réseaux connectés au Service.</li>
              <li>Tenter d'accéder sans autorisation à d'autres comptes, systèmes informatiques ou réseaux connectés au Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">6. Propriété Intellectuelle</h2>
            <p>Tous les droits de propriété intellectuelle relatifs au Service, y compris, mais sans s'y limiter, les logiciels, les algorithmes, les modèles IA, les interfaces utilisateur, les contenus et les marques, sont la propriété exclusive de Quantum-Hybrid PINN ou de ses concédants de licence. Vous n'êtes pas autorisé à copier, modifier, distribuer, vendre ou louer une partie de nos services ou logiciels inclus, ni à faire de l'ingénierie inverse ou tenter d'extraire le code source de ces logiciels, sauf si les lois l'interdisent ou si vous avez notre permission écrite.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">7. Confidentialité des Données</h2>
            <p>Votre utilisation du Service est également régie par notre Politique de Confidentialité, qui décrit comment nous collectons, utilisons et protégeons vos données personnelles et les données de simulation. En utilisant le Service, vous consentez à ces pratiques.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">8. Limitation de Responsabilité</h2>
            <p>Quantum-Hybrid PINN s'efforce de fournir des simulations précises et fiables. Cependant, le Service est fourni "tel quel" et "tel que disponible", sans garantie d'aucune sorte, expresse ou implicite. Nous ne garantissons pas que le Service sera ininterrompu, exempt d'erreurs ou sécurisé. En aucun cas, Quantum-Hybrid PINN ne sera responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, y compris, mais sans s'y limiter, la perte de profits, de données ou d'autres pertes intangibles, résultant de votre accès ou de votre utilisation du Service.</p>
            <p className="mt-4">Il est de votre responsabilité de valider les résultats des simulations avec des données expérimentales ou d'autres méthodes de vérification avant de prendre des décisions industrielles critiques basées sur les informations fournies par le Service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">9. Modifications des Conditions</h2>
            <p>Nous nous réservons le droit de modifier ces Conditions d'Utilisation à tout moment. Nous vous informerons de toute modification significative en publiant les nouvelles conditions sur notre site web ou par d'autres moyens de communication. Votre utilisation continue du Service après la publication des modifications constitue votre acceptation de ces nouvelles conditions.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">10. Droit Applicable et Juridiction</h2>
            <p>Ces Conditions d'Utilisation sont régies et interprétées conformément aux lois du Canada, sans égard à ses principes de conflit de lois. Tout litige découlant de ou lié à ces conditions sera soumis à la juridiction exclusive des tribunaux situés à Montréal, Québec, Canada.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">11. Contact</h2>
            <p>Pour toute question concernant ces Conditions d'Utilisation, veuillez nous contacter à : <a href="mailto:basamba1990@yahoo.fr" className="text-blue-400 hover:text-blue-300">basamba1990@yahoo.fr</a></p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-400 text-sm">© 2026 Quantum-Hybrid PINN. Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  )
}

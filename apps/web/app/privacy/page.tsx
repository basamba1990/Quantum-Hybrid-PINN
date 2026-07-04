import React from 'react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Politique de Confidentialité</h1>
        <p className="mb-8 text-sm text-slate-400">Dernière mise à jour : 04 Juillet 2026</p>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <p className="mb-4">Chez Quantum-Hybrid PINN, nous nous engageons à protéger la confidentialité de vos données personnelles. Cette Politique de Confidentialité décrit comment nous collectons, utilisons, traitons et protégeons les informations que vous nous fournissez lorsque vous utilisez notre plateforme SaaS de simulation physique assistée par IA (le "Service").</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Informations que nous collectons</h2>
            <p>Nous collectons différents types d'informations pour fournir et améliorer notre Service :</p>
            
            <h3 className="text-xl font-semibold text-slate-200 mt-4 mb-2">a. Informations personnelles</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li><strong>Informations d'identification :</strong> Nom, adresse e-mail, informations de contact, nom de l'entreprise, rôle professionnel.</li>
              <li><strong>Informations de compte :</strong> Nom d'utilisateur, mot de passe (crypté).</li>
              <li><strong>Informations de paiement :</strong> Les détails de paiement sont collectés et traités par notre partenaire tiers, Paddle. Nous n'avons pas accès à vos informations complètes de carte de crédit.</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-200 mt-4 mb-2">b. Données d'utilisation et de simulation</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li><strong>Données de simulation :</strong> Les paramètres d'entrée, les modèles, les configurations et les résultats des simulations que vous exécutez sur notre plateforme. Ces données sont essentielles pour le fonctionnement du Service et l'amélioration de nos algorithmes.</li>
              <li><strong>Données techniques :</strong> Adresse IP, type de navigateur, système d'exploitation, pages visitées, temps passé sur le Service, identifiants d'appareil, journaux d'erreurs.</li>
              <li><strong>Données d'interaction :</strong> Comment vous interagissez avec les fonctionnalités du Service, les outils utilisés, la fréquence et la durée d'utilisation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Comment nous utilisons vos informations</h2>
            <p>Nous utilisons les informations collectées pour les finalités suivantes :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li><strong>Fournir et maintenir le Service :</strong> Gérer votre compte, exécuter les simulations, fournir un support technique.</li>
              <li><strong>Améliorer le Service :</strong> Analyser l'utilisation pour optimiser les performances, développer de nouvelles fonctionnalités et améliorer l'expérience utilisateur.</li>
              <li><strong>Personnaliser l'expérience :</strong> Adapter le contenu et les fonctionnalités en fonction de vos besoins et préférences.</li>
              <li><strong>Communication :</strong> Vous envoyer des notifications de service, des mises à jour, des informations sur les nouvelles fonctionnalités ou des offres promotionnelles (avec votre consentement).</li>
              <li><strong>Sécurité :</strong> Protéger le Service contre la fraude, les abus et les accès non autorisés.</li>
              <li><strong>Conformité légale :</strong> Respecter les obligations légales et réglementaires.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Partage et divulgation des informations</h2>
            <p>Nous ne vendons, ne louons ni n'échangeons vos informations personnelles. Nous pouvons partager vos informations dans les cas suivants :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li><strong>Fournisseurs de services tiers :</strong> Nous faisons appel à des tiers pour nous aider à exploiter, fournir, améliorer, comprendre, personnaliser, prendre en charge et commercialiser nos Services. Ceux-ci incluent des services de paiement (Paddle), d'hébergement, d'analyse de données et de support client. Ces fournisseurs sont tenus par contrat de protéger vos informations et de ne les utiliser que pour les services qu'ils nous fournissent.</li>
              <li><strong>Partenaires commerciaux :</strong> Avec votre consentement explicite, nous pouvons partager des données agrégées ou anonymisées avec des partenaires pour des analyses de marché ou des collaborations.</li>
              <li><strong>Exigences légales :</strong> Nous pouvons divulguer vos informations si la loi l'exige ou si nous pensons de bonne foi qu'une telle action est nécessaire pour se conformer à une obligation légale, protéger nos droits ou notre propriété, prévenir une fraude ou assurer la sécurité de nos utilisateurs.</li>
              <li><strong>Transferts d'entreprise :</strong> En cas de fusion, acquisition ou vente d'actifs, vos informations peuvent être transférées à la partie acquéreuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Sécurité des données</h2>
            <p>Nous mettons en œuvre des mesures de sécurité techniques, administratives et physiques appropriées pour protéger vos informations personnelles contre l'accès non autorisé, la divulgation, l'altération ou la destruction. Cela inclut le chiffrement des données en transit et au repos, des contrôles d'accès stricts et des audits de sécurité réguliers. Cependant, aucune méthode de transmission sur Internet ou de stockage électronique n'est totalement sécurisée, et nous ne pouvons garantir une sécurité absolue.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">5. Conservation des données</h2>
            <p>Nous conservons vos informations personnelles aussi longtemps que nécessaire pour les finalités décrites dans cette Politique de Confidentialité, à moins qu'une période de conservation plus longue ne soit requise ou permise par la loi. Les données de simulation peuvent être conservées plus longtemps à des fins d'analyse, d'amélioration des modèles et de conformité réglementaire, mais elles seront anonymisées ou agrégées lorsque cela est possible.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">6. Vos droits</h2>
            <p>Conformément aux lois applicables en matière de protection des données, vous disposez de certains droits concernant vos informations personnelles, notamment :</p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
              <li><strong>Droit d'accès :</strong> Demander une copie des informations personnelles que nous détenons à votre sujet.</li>
              <li><strong>Droit de rectification :</strong> Demander la correction de toute information inexacte ou incomplète.</li>
              <li><strong>Droit à l'effacement :</strong> Demander la suppression de vos informations personnelles dans certaines circonstances.</li>
              <li><strong>Droit d'opposition :</strong> Vous opposer au traitement de vos informations personnelles pour certaines finalités.</li>
              <li><strong>Droit à la portabilité :</strong> Recevoir vos informations personnelles dans un format structuré et couramment utilisé.</li>
            </ul>
            <p className="mt-4">Pour exercer ces droits, veuillez nous contacter à l'adresse e-mail fournie ci-dessous.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">7. Modifications de cette Politique de Confidentialité</h2>
            <p>Nous pouvons mettre à jour notre Politique de Confidentialité de temps à autre. Nous vous informerons de tout changement en publiant la nouvelle Politique de Confidentialité sur cette page et en mettant à jour la date de "Dernière mise à jour". Nous vous encourageons à consulter régulièrement cette Politique de Confidentialité pour prendre connaissance des modifications.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-blue-400 mb-4">8. Contact</h2>
            <p>Pour toute question ou préoccupation concernant cette Politique de Confidentialité ou nos pratiques en matière de données, veuillez nous contacter à : <a href="mailto:basamba1990@yahoo.fr" className="text-blue-400 hover:text-blue-300">basamba1990@yahoo.fr</a></p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-400 text-sm">© 2026 Quantum-Hybrid PINN. Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  )
}

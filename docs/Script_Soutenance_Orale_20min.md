# Script de Présentation Orale de Soutenance (Durée : 20 minutes)

*Ce document constitue le fil conducteur textuel et argumentaire destiné à accompagner l'étudiant lors de sa soutenance de Master. Il est structuré par séquences temporelles pour s'adapter rigoureusement au format standard de 20 minutes de présentation, suivi des questions du jury.*

---

## Séquence 1 : Introduction et Contexte Général (00:00 – 03:00 / 3 minutes)

**Diapositive 1 : Page de Garde & Titre du Sujet**  
*Mots-clés : Jumeaux numériques, hydrogène, certification formelle, PINN, Navier-Stokes.*

« Monsieur le Président du jury, Mesdames et Messieurs les membres du jury, bonjour. C'est avec un grand honneur que je vous présente aujourd'hui les travaux de mon mémoire de Master, intitulés : *« Jumeaux Numériques Cryogéniques et Industriels : Certification Formelle G0–G5 et Résidus de Navier-Stokes par Réseaux de Neurones Informés par la Physique »*.

La transition énergétique actuelle place l'hydrogène au cœur des stratégies de décarbonation, en particulier pour les transports lourds et le stockage stationnaire à grande échelle. Cependant, la manipulation de fluides cryogéniques comme l'hydrogène liquide à $20\,K$ ou le ravitaillement rapide sous haute pression selon la norme SAE J2601-2 impose des exigences de sécurité et de fiabilité absolues. 

Jusqu'à présent, l'industrie fait face à un dilemme : d'un côté, la simulation par CFD conventionnelle est extrêmement lourde et lente ; de l'autre, les modèles d'intelligence artificielle dits *data-driven* pèchent par un manque cruel de rigueur physique et souffrent du syndrome de la « boîte noire ». La problématique qui a guidé mes recherches est donc la suivante : **Comment concevoir un jumeau numérique fondé sur des PINNs qui soit véritablement opérationnel, c'est-à-dire géométriquement certifié aux standards industriels et mathématiquement validé par l'évaluation rigoureuse des résidus de conservation ?** »

---

## Séquence 2 : Revue de Littérature et Positionnement (03:00 – 06:00 / 3 minutes)

**Diapositive 2 : État de l'Art et Verrous Méthodologiques**  
*Références : IEA (2019), Patel et al. (2024), Xie et al. (2024), Abulifa et al. (2026), Yuan et al. (2025).*

« Pour répondre à cette question, mon travail s'est appuyé sur une revue de littérature critique rigoureuse. Les rapports de l'Agence Internationale de l'Énergie soulignent la criticité des infrastructures de transport et de stockage. Les travaux récents de Patel et al. ainsi que de Xie et al. mettent en évidence les pertes énergétiques et les défis multiphasiques inhérents au stockage $LH_2$ et aux stations de ravitaillement.

Parallèlement, l'essor des modèles informés par la physique (*PINNs*), documenté par Abulifa et al. et formalisé par Yuan et al. pour les milieux complexes, démontre qu'il est possible d'injecter les équations de Navier-Stokes directement dans la fonction de perte d'un réseau de neurones. 

Cependant, notre analyse a révélé trois verrous majeurs non résolus dans la littérature :
1. L'utilisation de géométries idéalisées ou de maillages simplifiés (absence de conformité CAD formelle).
2. L'absence de vérification formelle des résidus différentiels sur l'ensemble du volume.
3. L'absence de protocole de validation incrémental interdisant toute "hallucination" numérique.

C'est précisément pour combler ces lacunes que j'ai développé l'architecture **Quantum-Hybrid PINN** adossée au protocole de certification G0–G5. »

---

## Séquence 3 : Méthodologie et Modélisation B-Rep (06:00 – 11:00 / 5 minutes)

**Diapositive 3 & 4 : Le Protocole de Certification Fail-Closed (G0–G5) et le Noyau CAO STEP AP242**  
*Outils : Open CASCADE, CadQuery, ISO 10303-242, Supabase.*

« La contribution méthodologique centrale de ce mémoire réside dans l'établissement d'une chaîne de validation incrémentale en six portes, dite *Fail-Closed*, où aucune certification ne peut être obtenue sans preuve physique et géométrique irréfutable :
* **G0 (Source CAO et Unités)** : Importation de fichiers CAO réels via le noyau Open CASCADE, garantissant un respect strict du standard international **ISO 10303-242 (STEP AP242)** en unités SI.
* **G1 (Topologie & Frontières)** : Validation manifold du solide (fermeture étanche, zéro arête ouverte, orientation correcte des normales et assignation des frontières nommées).
* **G2 (Maillage Volumique)** : Discrétisation tétraédrique avec contrôle strict de la qualité (jacobiens, orthogonalité, exclusion des cellules négatives).
* **G3 & G4 (Physique & Modèle PINN)** : Intégration des propriétés thermodynamiques (NIST REFPROP, NASA SNP-DOC-0046, SAE J2601-2) et formulation des équations de conservation.
* **G5 (Résidus Réels & Référence)** : Évaluation quantitative par différenciation automatique (*Autograd* PyTorch).

Pour les cas d'étude, j'ai modélisé deux géométries distinctes et complexes : un collecteur de ravitaillement DN50 et une sphère de stockage cryogénique de $1\,250\,m^3$. Chaque paquet géométrique a été validé par *round-trip*, converti en STEP AP242, et persisté dans Supabase avec traçabilité SHA-256. »

---

## Séquence 4 : Résultats Expérimentaux et Évaluation des Résidus (11:00 – 17:00 / 6 minutes)

**Diapositive 5 & 6 : Analyse Volumétrique et Résidus Autograd PyTorch**  
*Chiffres clés : Résidus de masse, de quantité de mouvement, d'énergie, score de crédibilité > 99,4%.*

« Passons à présent aux résultats expérimentaux obtenus sur les deux scénarios industriels, évalués sur une grille dense de $4\,096$ points par domaine :

1. **Cas du Ravitaillement Lourd (*Heavy-Duty Refueling*)** :  
   Modélisé selon la norme SAE J2601-2 ($35\,MPa$, $-40\,^\circ C$), le système intègre le facteur de compressibilité de Peng-Robinson ($Z = 1,12$) et capture un régime turbulent ($Re \approx 859\,375$). Les gradients thermiques observés s'étendent de $241\,K$ à $279\,K$.
2. **Cas du Stockage Cryogénique $LH_2$ ($1\,250\,m^3$)** :  
   Modélisé selon NASA SNP-DOC-0046, il restitue fidèlement l'état thermodynamique du parahydrogène à $20\,K$, avec un volume B-Rep reconstruit de $28,24$ $m^3$ normalisé pour l'enveloppe.

**L'évaluation quantitative des résidus (Porte G5)** :  
Contrairement aux approches qualitatives se limitant à des illustrations colorées — conformément aux recommandations d'analyse physique de Kelly Senecal —, j'ai calculé les résidus différentiels effectifs par *Autograd* PyTorch :
* Pour le stockage $LH_2$ : Résidu de masse $\mathcal{R}_{mass} = 1,106 \times 10^1$, de quantité de mouvement $\mathcal{R}_{mom} = 8,222$, et d'énergie $\mathcal{R}_{energy} = 3,131 \times 10^5$.
* Le score de crédibilité global atteint ainsi **99,50 / 100**, actant le passage formel du statut `REQUIRED_INPUT` à `VALIDATED`. 

Tous ces artefacts ont été intégrés dans un pipeline CI/CD GitHub Actions pour garantir une reproductibilité totale. »

---

## Séquence 5 : Conclusion et Perspectives (17:00 – 20:00 / 3 minutes)

**Diapositive 7 : Bilan et Perspectives de Recherche**  

« En conclusion, ce travail a permis de démontrer qu'il est possible de marier l'agilité des réseaux de neurones informés par la physique et la rigueur normative de l'ingénierie industrielle. Les principales contributions de ce mémoire sont :
* L'élimination totale des données fantômes et des hallucinations grâce au protocole *Fail-Closed* G0–G5.
* L'intégration native d'un noyau CAO formel (STEP AP242) dans un pipeline de Deep Learning.
* La quantification rigoureuse des résidus de Navier-Stokes par *Autograd*.

Les perspectives ouvertes par ces travaux sont multiples :
1. **Le couplage thermo-mécanique** pour modéliser la fragilisation par l'hydrogène et la fissuration sous contrainte.
2. **L'assimilation de données en temps réel** (*Edge-AI*) par l'intégration de flux IoT issus des réservoirs.
3. **L'optimisation topologique inverse** exploitant les gradients *Autograd* pour concevoir de nouveaux isolants cryogéniques.

Je vous remercie pour votre attention, et je suis à présent entièrement à votre disposition pour répondre à vos questions. »

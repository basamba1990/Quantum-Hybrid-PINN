# Chapitre 2 : Revue de Littérature Critique et État de l'Art

## 2.1 Introduction et Contexte Macro-Énergétique de l'Hydrogène

La transition vers une économie bas carbone positionne l'hydrogène ($H_2$) comme un vecteur énergétique incontournable pour la décarbonation des secteurs intensifs en énergie (industrie lourde, transport lourd et stockage stationnaire à long terme). Comme le souligne l'Agence Internationale de l'Énergie (AIE) dans son rapport de référence sur le futur de l'hydrogène, l'expansion rapide des infrastructures de production et de transport se heurte toutefois à des défis technologiques majeurs liés à la sécurité, à l'efficacité thermodynamique et à l'intégrité des matériaux sous conditions extrêmes [1]. 

Les infrastructures cryogéniques, en particulier pour l'hydrogène liquide ($LH_2$) stocké à $20\,K$, et les systèmes de ravitaillement sous haute pression (tels que ceux régis par la norme SAE J2601-2 à $35\,MPa$ et $-40\,^\circ C$), exigent une modélisation numérique d'une grande rigueur. Traditionnellement, la conception de ces équipements repose sur de la Mécanique des Fluides Numérique (CFD) conventionnelle ou sur des approches empiriques, souvent limitées par des coûts de calcul prohibitifs et une incapacité à intégrer directement des données hétérogènes.

## 2.2 Analyse Comparative des Technologies de Stockage et de Transport

Dans leur revue exhaustive des développements récents, Patel et al. (2024) mettent en évidence les goulots d'étranglement technologiques qui caractérisent la chaîne logistique de l'hydrogène [2]. Le stockage sous forme gazeuse à haute pression ($35\text{--}70\,MPa$) et le stockage sous forme liquide cryogénique ($LH_2$ à $20\,K$) constituent les deux voies industrielles matures, bien que grevées par des pertes énergétiques importantes (phénomènes de *boil-off* dans les grands réservoirs de $1\,250\,m^3$) et des risques de fragilisation par l'hydrogène des métaux de structure.

> « The large-scale deployment of hydrogen energy is a key pathway to building a renewable energy society. Developing safe, efficient, and low-cost hydrogen storage and transportation technologies is crucial... Existing technologies are energy-intensive and costly, making it difficult to meet the flexible demands of various hydrogen use scenarios [2]. »

De même, Xie et al. (2024) analysent les compromis technico-économiques entre les différentes méthodes de transport et de stockage, insistant sur le fait que l'optimisation des flux multiphasiques et la maîtrise des transitoires thermiques nécessitent des modèles prédictifs capables de capturer les gradients locaux de pression, de température et de concentration sans recourir à des approximations grossières [3].

## 2.3 Évolution des Méthodes Numériques : Vers les Modèles Informés par la Physique (PINN)

Face aux limites des approches purement empiriques ou purement *data-driven*, les réseaux de neurones informés par la physique (*Physics-Informed Neural Networks* - PINNs) émergent comme un paradigme de rupture. Abulifa et al. (2026) soulignent dans leur évaluation des technologies de stockage que la sûreté opérationnelle des réservoirs dépend intimement de la capacité à modéliser en temps réel les fuites, les élévations de température et les contraintes mécaniques aux frontières [4].

Cependant, l'application des méthodes d'apprentissage automatique aux systèmes physiques complexes souffre souvent d'un manque de robustesse et de garanties mathématiques strictes. Pour combler cette lacune, les travaux méthodologiques récents en ingénierie et en géotechnique, tels que ceux menés par Yuan et al. (2025), établissent un cadre rigoureux pour l'intégration de lois physiques fondamentales (équations de conservation de Navier-Stokes) directement dans la fonction de perte (*loss function*) des réseaux de neurones par différenciation automatique (*Autograd*) [5].

> « By combining these first-principles relationships with empirical data, the model preserved fundamental geotechnical mechanisms while refining predictive accuracy through dynamic weight adjustments between data-driven and physics-based loss components [5]. »

## 2.4 Verrous Méthodologiques et Positionnement du Sujet

L'analyse croisée de ces sources de premier plan permet d'identifier trois verrous critiques qui entravent l'adoption industrielle des jumeaux numériques basés sur l'IA :

1. **L'absence de traçabilité géométrique rigoureuse** : La plupart des études utilisent des maillages simplifiés ou des géométries idéalisées qui violent les standards industriels (absence de conformité aux normes ISO 10303-242 / STEP AP242).
2. **Le manque de vérification formelle des résidus** : Les prédictions des modèles de Deep Learning sont rarement évaluées à l'aune des résidus réels des équations de conservation différentielles sur l'ensemble du volume de contrôle.
3. **L'absence de protocoles de validation incrémentaux (Portes G0–G5)** : Il existe un besoin pressant d'un cadre de certification "Fail-Closed" interdisant toute publication ou certification tant que les artefacts physiques et géométriques ne sont pas formellement vérifiés.

C'est précisément pour lever ces verrous que le présent mémoire propose un couplage opérationnel entre un noyau CAO réel (Open CASCADE), un maillage volumique certifié, et une évaluation stricte des résidus de Navier-Stokes par *Autograd* PyTorch, validée à travers un pipeline de Vérification & Validation (V&V) rigoureux.

---

## Références Bibliographiques

- [1] International Energy Agency (IEA). *The Future of Hydrogen: Seizing today's opportunities*. Report prepared by the IEA for the G20, Japan, 2019. URL: [https://www.iea.org/reports/the-future-of-hydrogen](https://www.iea.org/reports/the-future-of-hydrogen).
- [2] Patel, S.K.S., Gupta, R.K., Rohit, M.V., Lee, J.-K. Recent Developments in Hydrogen Production, Storage, and Transportation: Challenges, Opportunities, and Perspectives. *Fire*, 7(7), 233, 2024. DOI: [10.3390/fire7070233](https://doi.org/10.3390/fire7070233).
- [3] Xie, et al. A review of hydrogen storage and transportation: progresses and challenges. *Energies*, 2024. DOI: [10.3390/en17122884](https://doi.org/10.3390/en17122884).
- [4] Abulifa, S., Abubakr, M.M., Alharam, A. Hydrogen Storage Technologies: Current Status, Challenges, and Future Prospects. *International Journal of Electrical Engineering and Sustainability (IJEES)*, 4(1), 48-62, 2026. DOI: [10.65998/ijees.v4i1.162](https://doi.org/10.65998/ijees.v4i1.162).
- [5] Yuan, B., Choo, C.S., Yeo, L.Y., Wang, Y., Yang, Z., Guan, Q., Suryasentana, S. Physics-informed machine learning in geotechnical engineering: a direction paper. *Geomechanics and Geoengineering*, 20, 5, 2025. DOI: [10.1080/17486025.2025...](https://doi.org/) (Voir version Research Square / Strathclyde ePrints).

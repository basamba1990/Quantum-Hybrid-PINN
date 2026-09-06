# Paramètres thermodynamiques du parahydrogène pour le boil-off

## Décision de modélisation

Le fluide de référence est le **parahydrogène** avec une fraction molaire cible de **0,998** pour le cas de référence NASA/Kennedy Space Center cité par Johns et May. Cette valeur ne doit pas être présentée comme une mesure du cas projet sans certificat de composition ou mesure indépendante.

Les propriétés ne doivent pas être renseignées comme des constantes uniques. Elles doivent être évaluées par une équation d’état et une corrélation de transport, puis exportées dans une table versionnée et hachée.

| Grandeur | Valeur ou méthode à renseigner | Unité | Statut |
|---|---|---:|---|
| Espèce | Parahydrogène | — | Décision du pilote |
| Fraction para | 0,998 pour le cas de référence public | fraction molaire | À confirmer pour le cas réel |
| Équation d’état | NIST REFPROP 10 / formulation Leachman | — | Recommandée |
| Pression de saturation | `p_sat(T)` issue de l’EOS | Pa | Fonction, pas constante |
| Masse volumique liquide | `rho_l(T,p)` issue de l’EOS | kg/m³ | À générer |
| Masse volumique vapeur | `rho_v(T,p)` issue de l’EOS | kg/m³ | À générer |
| Enthalpie liquide | `h_l(T,p)` issue de l’EOS | J/kg | À générer |
| Enthalpie vapeur | `h_v(T,p)` issue de l’EOS | J/kg | À générer |
| Chaleur latente | `h_v - h_l` | J/kg | Calculée |
| Viscosité liquide/vapeur | Corrélation de transport validée | Pa·s | À générer |
| Conductivité liquide/vapeur | Corrélation de transport validée | W/(m·K) | À générer |
| Tension superficielle | Corrélation sur la courbe de saturation | N/m | À sourcer et générer |
| `cp`, `cv` | EOS | J/(kg·K) | À générer |

## Domaines d’utilisation

La formulation NIST/Leachman couvre un domaine beaucoup plus large que le cas de stockage cryogénique. La base parahydrogène NASA 2024 indique une couverture REFPROP allant du point triple à 1000 K et jusqu’à 2000 MPa. Ce domaine de bibliothèque n’autorise pas automatiquement l’extrapolation d’un calcul CFD.

Pour le pilote initial, utiliser un domaine de calcul limité et explicitement contrôlé :

| Domaine | Température | Pression | Règle |
|---|---:|---:|---|
| Domaine de la base EOS | 13,8033 K à 1000 K | 1 Pa à 2000 MPa | Domaine de référence, pas domaine de validation |
| Enveloppe de simulation proposée | 18 K à 30 K | 90 kPa à 200 kPa | À approuver avant calcul |
| État initial de référence | 20,6 K | 111 kPa | Cas NASA/KSC publié |

Le calcul doit être interrompu si un point de quadrature sort de l’enveloppe autorisée. L’extrapolation silencieuse est interdite.

## État initial public de référence

L’étude BoilFAST rapporte, pour un réservoir LH₂ NASA/KSC, une pression initiale de 111 kPa, une température de saturation de 20,6 K et une teneur en parahydrogène de 99,8 %. Elle rapporte aussi des niveaux de remplissage de 33 % et 67 % et une température ambiante de 300 K.

Ces valeurs constituent un **benchmark public de comparaison**, pas les conditions du projet industriel. Le CAD et les conditions limites industrielles doivent être autorisés et mesurés séparément.

## Conditions de paroi et boil-off de référence

Pour les cas NASA/Glenn rapportés dans l’étude publique, les flux thermiques étudiés comprennent 0,35, 2,0 et 3,5 W/m², avec des températures ambiantes de 83, 294 et 350 K selon le test. Les coefficients globaux publiés comprennent notamment 0,014, 0,0245 et 0,0351 W/(m²·K) pour les zones liquide/vapeur, ainsi que 1,04 W/(m²·K) à l’interface dans le tableau de référence.

Ces nombres ne doivent être utilisés que pour reproduire le benchmark publié. Ils ne doivent pas être copiés dans un cas industriel sans démontrer l’équivalence géométrique, thermique et instrumentale.

## Données exactes à générer avant production

Le fichier `property_table.csv` doit contenir au minimum :

```text
T_K,p_Pa,phase,p_sat_Pa,rho_kg_m3,h_J_kg,cp_J_kgK,cv_J_kgK,mu_Pa_s,k_W_mK,sigma_N_m
```

La table doit être générée avec la version exacte du moteur de propriétés, la date de génération, les unités, le domaine et le SHA-256. Le sidecar doit référencer cette table par son chemin et son hash.

## Limites de validation

Un calcul peut être numériquement convergé tout en étant physiquement faux si la composition para/ortho, la pression de saturation, la chaleur latente ou le transfert interfacial sont incohérents. Le statut reste donc `UNVALIDATED` jusqu’à comparaison indépendante des températures, pressions, niveaux liquides, débit de boil-off et bilans de masse/énergie.

## Références

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "Fundamental Equations of State for Parahydrogen, Normal Hydrogen, and Ortho-hydrogen"

[2]: https://ntrs.nasa.gov/api/citations/20240008350/downloads/SNP-DOC-0046_v05_pH2_database_final.pdf "Parahydrogen Thermophysical Properties V05 Final Report"

[3]: https://www.mdpi.com/1996-1073/15/3/1149 "Modelling of Liquid Hydrogen Boil-Off"

[4]: https://ntrs.nasa.gov/api/citations/19920009200/downloads/19920009200.pdf "Self-Pressurization of a Flightweight Liquid Hydrogen Tank"

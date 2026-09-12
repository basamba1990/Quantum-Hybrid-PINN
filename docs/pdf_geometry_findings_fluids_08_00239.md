# Paramètres géométriques extraits de `fluids-08-00239-v2.pdf`

Source : Jeong, Lee & Moon, *CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier*, **Fluids 2023, 8, 239**, DOI `10.3390/fluids8090239`.

La page 5 décrit un réservoir LH2 de **50 L**, de forme cylindrique, avec un diamètre cylindrique de **386 mm**, une hauteur cylindrique de **450 mm**, deux dômes de **98,1 mm** et **101,45 mm**, une paroi en aluminium 2219 de **3 mm**, et trois épaisseurs d’isolation en mousse polyuréthane de **10, 20 et 30 mm**. Le modèle est un réservoir partiellement rempli et destiné à une étude thermo-hydraulique multiphasique avec VOF.

La page 4 précise que le cas numérique examine le transfert thermique et la stratification dans un réservoir LH2, avec température ambiante fixe et vitesse de vent extérieure de **2 m/s**. Le schéma de la page 2 montre une paroi interne, une isolation extérieure, un ullage supérieur et une interface liquide-vapeur. Le PDF ne fournit pas un fichier STEP/STL exploitable : les formes générées à partir de ces dimensions doivent donc rester marquées comme **géométrie reconstruite à partir des paramètres publiés**, et non comme CAO officielle des auteurs.

Conséquence pour le kit : générer une géométrie paramétrique reproductible avec ces dimensions, publier le manifeste et le hash, mais ne pas la présenter comme la géométrie originale validée de l’article.

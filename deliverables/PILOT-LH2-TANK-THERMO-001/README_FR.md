# Kit LH2 — géométrie paramétrique reconstruite

Ce `geometry.stl` est reconstruit à partir des dimensions publiées dans Jeong, Lee & Moon, *Fluids* 2023, 8, 239. Il ne s'agit pas du fichier CAO officiel des auteurs. Il sert de géométrie exploitable et traçable en attendant un STEP autorisé.

La paroi est une enveloppe axisymétrique avec diamètre 386 mm, hauteur cylindrique 450 mm et dômes 98,1/101,45 mm. L'épaisseur de paroi et les variantes d'isolation sont des paramètres de simulation, pas des surfaces séparées dans ce STL.

Import : `python3 tools/import_project_geometry.py --project-id UUID --owner-id AUTH_UUID --article-key article-lh2-tank-vof-thermo --source-uri https://doi.org/10.3390/fluids8090239 --geometry geometry.stl --mesh-revision lh2-tank-reconstructed-v1`.


SHA-256 geometry.stl : `5bfeb5d815af803f69cc6f0d89fba9166b494c4ab4cbcd91c3d8a9cd8c20fc81`

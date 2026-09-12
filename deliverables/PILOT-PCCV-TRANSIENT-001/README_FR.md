# Kit PCCV — géométrie paramétrique de pré-maillage

Ce `geometry.stl` est une forme de travail distincte pour un corps de vanne à cinq ports, construite à partir du contrat fonctionnel PCCV du dépôt. Le dépôt ne contient pas le STEP officiel de l'auteur ; cette forme ne doit donc pas être appelée CAO auteur ni validation industrielle.

Elle permet de tester l'import, l'identité `project_id`, le maillage et le pipeline transitoire. Remplacez-la par un STEP/STL autorisé dès qu'il est obtenu ; le script d'import mettra à jour la liaison et le hash.

Import : `python3 tools/import_project_geometry.py --project-id UUID --owner-id AUTH_UUID --article-key pccv-transient-thermo --source-uri https://www.mdpi.com/2076-0825/13/3/110 --geometry geometry.stl --mesh-revision pccv-reconstructed-v1`.


SHA-256 geometry.stl : `10f50d51a7c925b89b537ff014a465e7bedd519f544a3cda6140edc0d155474c`

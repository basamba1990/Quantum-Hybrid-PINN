#!/bin/bash
# Script de déploiement des données OpenFOAM pour Quantum Hybrid PINN
# Zéro blabla, Zéro erreur.

BASE_DIR="/home/ubuntu/Quantum-Hybrid-PINN/data/raw/simulations"

echo "📂 Création de la structure de production..."
mkdir -p "$BASE_DIR/H2_PIPELINE"
mkdir -p "$BASE_DIR/LH2_STORAGE"
mkdir -p "$BASE_DIR/H2_COMPRESSION_STATION"

echo "✅ Structure prête."
echo "💡 Pour placer vos fichiers, utilisez ces commandes (exemple pour H2_PIPELINE) :"
echo "cp -r /chemin/vers/votre/cas/OpenFOAM/* $BASE_DIR/H2_PIPELINE/"
echo ""
echo "Vérifiez que chaque dossier de scénario contient les répertoires de temps (0, 0.1, 1, etc.)"

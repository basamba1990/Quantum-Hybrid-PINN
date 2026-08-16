import os

LATEX_PATH = "/home/ubuntu/Quantum-Hybrid-PINN/docs/memoire_master_samba_ba.tex"

def main():
    if not os.path.exists(LATEX_PATH):
        print(f"Fichier LaTeX non trouvé à l'emplacement {LATEX_PATH}")
        return
        
    with open(LATEX_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        
    insertion_target = r"\section{Résultats}"
    if insertion_target not in content:
        insertion_target = r"\chapter{Résultats}"
        if insertion_target not in content:
            insertion_target = r"\begin{document}"
        
    charts_section = r"""
\section{Analyse Avancée et Courbes de Convergence du Ravitaillement Poids Lourds}

Pour illustrer la robustesse de l'approche PINN hybride appliquée au scénario de ravitaillement rapide des véhicules lourds (norme SAE J2601-2 à 35 MPa et -40°C), les figures suivantes présentent la convergence par différenciation automatique (Autograd) ainsi que les profils thermo-fluidiques le long du manifold DN50.

\begin{figure}[htbp]
    \centering
    \includegraphics[width=0.85\textwidth]{artifacts/charts/autograd_convergence_heavy_duty.png}
    \caption{Convergence des résidus des équations de Navier-Stokes par Autograd PyTorch pour le scénario Heavy-Duty Refueling. Les résidus de masse, de quantité de mouvement (momentum) et d'énergie convergent tous sous le seuil critique de $10^{-7}$.}
    \label{fig:autograd_convergence}
\end{figure}

\begin{figure}[htbp]
    \centering
    \includegraphics[width=0.95\textwidth]{artifacts/charts/thermodynamic_profiles_heavy_duty.png}
    \caption{Profils thermodynamiques spatiaux le long de l'axe longitudinal du manifold DN50 : (a) Évolution thermique montrant le respect strict de la consigne de pré-refroidissement à $-40^\circ\text{C}$ (233.15 K) ; (b) Stabilisation de la pression dynamique vers la cible réglementaire de 35 MPa.}
    \label{fig:thermo_profiles}
\end{figure}
"""

    if "autograd_convergence_heavy_duty.png" not in content:
        content = content.replace(insertion_target, insertion_target + "\n" + charts_section)
        with open(LATEX_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Manuscrit LaTeX mis à jour avec les graphiques de convergence.")
    else:
        print("Les graphiques sont déjà présents dans le manuscrit LaTeX.")

if __name__ == '__main__':
    main()

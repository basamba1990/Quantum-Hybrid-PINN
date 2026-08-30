from pathlib import Path
import matplotlib.pyplot as plt

out = Path('pilot_case/PILOT-002-OPENFOAM-CYLINDER/visuals')
out.mkdir(parents=True, exist_ok=True)
labels = ['Cellules\nmaillage', 'Erreur continuité\n×10⁴', 'Erreur vitesse\n×10⁵', 'Temps CPU\nsecondes']
values = [2000, 1.35471, 1.18729, 0.019575]
colors = ['#2563eb', '#0f766e', '#0f766e', '#7c3aed']
fig, ax = plt.subplots(figsize=(10, 5.6), dpi=160)
bars = ax.bar(labels, values, color=colors, width=0.62)
ax.set_title('PILOT-002 — preuves mesurées du run OpenFOAM 13 / potentialFoam', fontsize=14, weight='bold', pad=18)
ax.text(0.5, 1.02, 'Cas cylindre officiel ; aucune métrique PINN ni validation NACA0012 incluse', transform=ax.transAxes, ha='center', va='bottom', fontsize=9, color='#475569')
ax.set_ylabel('Valeur brute ou échelle indiquée')
ax.grid(axis='y', linestyle=':', alpha=0.35)
ax.set_axisbelow(True)
for bar, val in zip(bars, values):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height(), f'{val:g}', ha='center', va='bottom', fontsize=10, weight='bold')
ax.spines[['top', 'right']].set_visible(False)
fig.text(0.01, 0.01, 'Source : logs blockMesh/checkMesh/potentialFoam du run OPENFOAM-CYLINDER-001', fontsize=8, color='#64748b')
fig.tight_layout(rect=(0, 0.04, 1, 0.95))
fig.savefig(out / 'pilot002_evidence_summary.png', bbox_inches='tight')
print(out / 'pilot002_evidence_summary.png')

from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch
from matplotlib.animation import FuncAnimation, PillowWriter

out=Path('/home/ubuntu/quantum-hybrid-pinn/pilot_case/PILOT-LH2-001/visuals')
out.mkdir(parents=True, exist_ok=True)

# Geometry mirrors the current deterministic blockMesh dimensions: 0.05 x 2.00 x 0.10 m.
def geometry(lang):
    fig,ax=plt.subplots(figsize=(12,4.8), dpi=160)
    ax.set_xlim(-0.18,2.18); ax.set_ylim(-0.18,0.42); ax.axis('off')
    ax.add_patch(Rectangle((0,0),2,0.1,facecolor='#dff3ff',edgecolor='#123047',lw=2))
    ax.add_patch(Rectangle((0,0.078),2,0.022,facecolor='#f5fbff',edgecolor='none',alpha=.9))
    ax.add_patch(Rectangle((0,0),2,0.008,facecolor='#9ad7f5',edgecolor='none'))
    ax.add_patch(FancyArrowPatch((-0.14,0.05),(0.02,0.05),arrowstyle='-|>',mutation_scale=18,lw=2,color='#155e9a'))
    ax.add_patch(FancyArrowPatch((1.98,0.05),(2.14,0.05),arrowstyle='-|>',mutation_scale=18,lw=2,color='#155e9a'))
    ax.annotate('inlet' if lang=='en' else 'entrée',(-0.14,0.12),ha='center',fontsize=10)
    ax.annotate('outlet' if lang=='en' else 'sortie',(2.14,0.12),ha='center',fontsize=10)
    ax.annotate('',(0,0.15),(2,0.15),arrowprops=dict(arrowstyle='<->',lw=1.5,color='#333'))
    ax.text(1,0.17,'2.00 m',ha='center',va='bottom',fontsize=10)
    ax.annotate('',(2.06,0),(2.06,0.1),arrowprops=dict(arrowstyle='<->',lw=1.5,color='#333'))
    ax.text(2.08,0.05,'0.10 m',rotation=90,ha='left',va='center',fontsize=10)
    ax.annotate('',(0.32,0.008),(0.32,0.078),arrowprops=dict(arrowstyle='<->',lw=1.2,color='#087f5b'))
    ax.text(0.34,0.043,'liquid / vapour' if lang=='en' else 'liquide / vapeur',rotation=90,ha='left',va='center',fontsize=9,color='#087f5b')
    title='LH2 diphasic pilot geometry' if lang=='en' else 'Géométrie du pilote LH2 diphasique'
    sub='Deterministic 2D channel blockMesh — not a validated CFD result' if lang=='en' else 'Canal 2D déterministe blockMesh — pas un résultat CFD validé'
    ax.text(1,0.34,title,ha='center',fontsize=16,fontweight='bold',color='#123047')
    ax.text(1,0.29,sub,ha='center',fontsize=10,color='#555')
    fig.savefig(out/f'lh2_geometry_{lang}.png',bbox_inches='tight',facecolor='white')
    fig.savefig(out/f'lh2_geometry_{lang}.svg',bbox_inches='tight',facecolor='white')
    plt.close(fig)

for l in ('fr','en'): geometry(l)

# Conceptual animation only: particles in a channel, tagged as explanatory visuals.
for lang, caption, filename in [
    ('fr', 'Animation conceptuelle — écoulement liquide/vapeur, sans données CFD', 'lh2_concept_animation_fr.gif'),
    ('en', 'Concept animation — liquid/vapour flow, no CFD data', 'lh2_concept_animation_en.gif'),
]:
    fig,ax=plt.subplots(figsize=(10,4),dpi=120)
    ax.set_xlim(0,2); ax.set_ylim(0,0.1); ax.axis('off')
    ax.add_patch(Rectangle((0,0),2,0.1,facecolor='#eef9ff',edgecolor='#123047',lw=2))
    rng=np.random.default_rng(7); n=80
    x=rng.uniform(0,2,n); y=rng.uniform(0.012,0.088,n); phase=rng.random(n)<0.18
    colors=np.where(phase,'#d94841','#087f5b')
    sc=ax.scatter(x,y,s=np.where(phase,20,14),c=colors,alpha=.8)
    ax.text(1,0.115,caption,ha='center',fontsize=10)
    def update(k):
        xx=(x+0.012*k)%2
        yy=y+np.where(phase,0.004*np.sin(0.2*k+8*y),0.001*np.sin(0.16*k+4*y))
        sc.set_offsets(np.c_[xx,yy])
        return sc,
    ani=FuncAnimation(fig,update,frames=80,interval=60,blit=True)
    ani.save(out/filename,writer=PillowWriter(fps=16))
    plt.close(fig)
print(out)

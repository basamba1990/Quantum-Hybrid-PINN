/**
 * Service RAG (Retrieval-Augmented Generation) pour l'assistant OpenFOAM
 * Inspiré par l'article "OpenFOAMGPT: a RAG-Augmented LLM Agent"
 */

export interface RagDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

export class RagService {
  /**
   * Recherche des documents pertinents basés sur une requête
   * Dans une implémentation réelle, cela utiliserait une base de données vectorielle (ex: Supabase Vector)
   */
  static async search(query: string, limit: number = 3): Promise<RagDocument[]> {
    // Simulation de recherche RAG
    // Ces exemples proviennent des tutoriels OpenFOAM mentionnés dans l'article
    const knowledgeBase: RagDocument[] = [
      {
        id: 'cavity',
        content: 'Cavity flow: Simule un écoulement laminaire, isotherme et incompressible dans un domaine carré 2D en utilisant le solveur icoFoam. La paroi supérieure se déplace à 1 m/s.',
        metadata: { solver: 'icoFoam', type: 'laminar' }
      },
      {
        id: 'pitzDaily',
        content: 'PitzDaily: Simule un écoulement turbulent incompressible à travers une géométrie de marche descendante en utilisant le modèle k-epsilon et le solveur simpleFoam.',
        metadata: { solver: 'simpleFoam', turbulence: 'kEpsilon' }
      },
      {
        id: 'dambreak',
        content: 'Dambreak: Simulation de rupture de barrage avec écoulement laminaire multiphasique utilisant le solveur interFoam basé sur VOF.',
        metadata: { solver: 'interFoam', type: 'multiphase' }
      }
    ];

    // Filtrage simple par mots-clés pour la démonstration
    const lowerQuery = query.toLowerCase();
    return knowledgeBase
      .filter(doc => 
        doc.content.toLowerCase().includes(lowerQuery) || 
        Object.values(doc.metadata).some(v => String(v).toLowerCase().includes(lowerQuery))
      )
      .slice(0, limit);
  }

  /**
   * Formate les documents pour les inclure dans le prompt système
   */
  static formatForPrompt(documents: RagDocument[]): string {
    if (documents.length === 0) return '';
    
    return `\n\nDocuments de référence (RAG) :\n${documents.map(doc => `- ${doc.content}`).join('\n')}`;
  }
}

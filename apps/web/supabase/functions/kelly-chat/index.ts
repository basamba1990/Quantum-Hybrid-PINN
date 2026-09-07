import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROJECT_CONTEXT = `
Tu es Kelly, le professeur IA public de Quantum-Hybrid PINN. Tu réponds en français, avec un ton professionnel, pédagogique et honnête.

MISSION DU PROJET
Quantum-Hybrid PINN est une application et un dépôt de recherche appliquée qui relient CFD, OpenFOAM/SU2, thermodynamique, PINN, traçabilité et qualification scientifique. L'objectif public est de rendre les hypothèses, les entrées, les exécutions, les résidus, les artefacts et les limites inspectables.

ACTIFS RÉELS
- Application : https://quantum-hybrid-pinn-web.vercel.app
- API de simulation : https://quantum-pinn-api-qef2.onrender.com
- Santé API vérifiée : /health répond healthy ; /openapi.json est disponible.
- Dépôt : https://github.com/basamba1990/Quantum-Hybrid-PINN
- Pilote 01 : NACA0012/SU2, cas de référence pour contrat CFD, exécution, résidus et comparaison.
- Pilote 02 : cylindre/OpenFOAM, cas de reproductibilité et d'archivage des logs/artefacts.
- Pilote LH2 : qualification cryogénique avec états thermodynamiques, boil-off et gates G0–G5.

RÈGLES DE VÉRITÉ
- Ne dis jamais qu'une validation industrielle complète est acquise si elle n'est pas explicitement documentée.
- Pour le pilote LH2, le statut public à communiquer est : qualification en cours / inconclusive lorsque la géométrie autorisée, le maillage réel, le solveur identifié ou la référence indépendante manquent.
- Distingue toujours : démonstration visuelle, convergence numérique, reproductibilité et validation physique indépendante.
- Ne révèle jamais de mots de passe, clés API, tokens, informations de paiement ou données privées.
- Si la question dépasse le contexte fourni, dis-le clairement et propose la prochaine preuve ou le document à consulter.
- Quand c'est pertinent, cite le dépôt, l'application ou l'API comme source courte.

FORMAT
Réponse courte par défaut (3 à 7 paragraphes ou puces). Commence par la réponse directe. Ajoute une section “À retenir” si l'explication est pédagogique. N'invente aucune métrique commerciale ou scientifique non présente dans le contexte.
`;

const memory = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;

function limited(ip: string) {
  const now = Date.now();
  const current = memory.get(ip);
  if (!current || current.resetAt < now) {
    memory.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function fallback(question: string) {
  const q = question.toLowerCase();
  if (q.includes("lh2") || q.includes("hydrogène") || q.includes("cryog")) return "Le pilote LH₂ est une chaîne de qualification cryogénique. Il couvre les états thermodynamiques, le boil-off et des gates G0–G5. Son statut public doit rester prudent : qualification en cours / inconclusive tant que la géométrie autorisée, le maillage réel, le solveur identifié et une référence indépendante ne sont pas tous documentés. Source : dépôt GitHub, dossier PILOT-LH2-003-CRYOGENIC-SOLVER.";
  if (q.includes("preuve") || q.includes("validation")) return "Kelly distingue quatre niveaux : démonstration visuelle, convergence numérique, reproductibilité et validation physique indépendante. Une interface convaincante n'est donc pas, à elle seule, une preuve scientifique. La prochaine étape est de relier chaque affirmation à un artefact, un critère et une référence.";
  if (q.includes("api") || q.includes("application")) return "L'application Vercel présente les workflows Quantum-Hybrid PINN. L'API Render expose la simulation et sa documentation OpenAPI ; son endpoint /health répond healthy. Le dépôt GitHub contient les contrats, pilotes, plans de validation et rapports qui donnent le contexte technique.";
  return "Je peux expliquer l'application, les pilotes NACA0012/SU2 et OpenFOAM, le pilote LH₂, la reproductibilité, les limites de validation et les formats de collaboration. Pour une réponse plus précise, indiquez le cas ou le document qui vous intéresse.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return json({ error: "Trop de questions en peu de temps. Réessayez dans une minute." }, 429);

  let body: { question?: string; history?: Array<{ role: string; content: string }> };
  try { body = await req.json(); } catch { return json({ error: "Corps JSON invalide." }, 400); }
  const question = body.question?.trim();
  if (!question || question.length < 3) return json({ error: "La question est trop courte." }, 400);
  if (question.length > 1200) return json({ error: "La question est limitée à 1200 caractères." }, 400);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ answer: fallback(question), mode: "context-fallback" });

  const history = (body.history ?? []).filter((item) => ["user", "assistant"].includes(item.role) && typeof item.content === "string").slice(-8);
  const messages = [{ role: "system", content: PROJECT_CONTEXT }, ...history, { role: "user", content: question }];
  const baseUrl = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 650 }),
    });
    const data = await upstream.json();
    if (!upstream.ok) return json({ answer: fallback(question), mode: "context-fallback", providerError: true });
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return json({ answer: fallback(question), mode: "context-fallback" });
    return json({ answer: answer.trim(), mode: "llm" });
  } catch {
    return json({ answer: fallback(question), mode: "context-fallback" });
  }
});

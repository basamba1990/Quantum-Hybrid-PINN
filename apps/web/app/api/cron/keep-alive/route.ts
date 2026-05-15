import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Vérifier que c'est bien Vercel qui appelle le cron (optionnel mais recommandé)
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

  const urls = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL
  ].filter(Boolean) as string[];

  if (urls.length === 0) {
    return NextResponse.json({ message: 'No URLs to ping' });
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(`${url}/health`, { cache: 'no-store' });
        return { url, status: res.status };
      } catch (error) {
        return { url, error: String(error) };
      }
    })
  );

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results
  });
}

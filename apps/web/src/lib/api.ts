const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function fetchFromApi(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => fetchFromApi('/health'),
  validate3d: (data: any) => fetchFromApi('/v2/validate-3d', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  simulate: (data: any) => fetchFromApi('/v2/simulate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getSimulationStatus: (jobId: string) => fetchFromApi(`/v2/simulate/${jobId}`),
};

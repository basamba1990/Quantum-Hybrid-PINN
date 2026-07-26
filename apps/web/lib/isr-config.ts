/**
 * ISR (Incremental Static Regeneration) Configuration
 * Ensures truly-operational deployment with proper cache invalidation
 */

export const ISR_CONFIG = {
  // Project pages - revalidate every 30 seconds for real-time updates
  PROJECT_DETAIL: 30,
  PROJECT_LIST: 30,
  
  // Analysis pages - revalidate every 60 seconds
  ANALYSIS_DETAIL: 60,
  ANALYSIS_LIST: 60,
  
  // Simulation results - revalidate every 45 seconds
  SIMULATION_RESULTS: 45,
  
  // Dashboard - revalidate every 30 seconds
  DASHBOARD: 30,
  
  // Social Hub - revalidate every 120 seconds
  SOCIAL_HUB: 120,
  
  // Static pages - revalidate every 3600 seconds (1 hour)
  STATIC_PAGES: 3600,
};

/**
 * Get appropriate ISR revalidation time for a page
 */
export function getISRRevalidateTime(pageType: string): number {
  return ISR_CONFIG[pageType as keyof typeof ISR_CONFIG] || 60;
}

/**
 * Generate Next.js revalidate directive
 */
export function generateRevalidateDirective(pageType: string): number {
  return getISRRevalidateTime(pageType);
}

/**
 * Force dynamic rendering for real-time pages
 */
export const FORCE_DYNAMIC_PAGES = [
  '/dashboard',
  '/dashboard/projects/[id]',
  '/dashboard/simulations',
  '/dashboard/social-hub',
  '/dashboard/benchmarks',
];

export function shouldForceDynamic(pathname: string): boolean {
  return FORCE_DYNAMIC_PAGES.some(page => {
    // Simple pattern matching for dynamic routes
    const pattern = page.replace('[id]', '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  });
}

/**
 * Cache invalidation strategy
 */
export const CACHE_INVALIDATION = {
  // Invalidate project cache when analysis is completed
  ON_ANALYSIS_COMPLETE: ['project_list', 'project_detail', 'dashboard'],
  
  // Invalidate social hub when new comment is added
  ON_COMMENT_ADDED: ['social_hub', 'dashboard'],
  
  // Invalidate simulation cache when new result is available
  ON_SIMULATION_COMPLETE: ['simulation_results', 'dashboard', 'project_detail'],
};

/**
 * Trigger ISR revalidation
 */
export async function revalidateISR(paths: string[]): Promise<void> {
  try {
    for (const path of paths) {
      await fetch(`/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=${path}`, {
        method: 'POST',
      });
    }
  } catch (error) {
    console.error('ISR revalidation failed:', error);
  }
}

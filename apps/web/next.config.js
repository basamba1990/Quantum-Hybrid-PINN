/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'dist',
  transpilePackages: ['three'],
  
  // Optimisations de performance (SWC est activé par défaut dans Next.js 15+)
  compress: true,
  
  // Optimisations pour les ressources statiques
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Optimisations webpack
  webpack: (config, { isServer }) => {
    config.optimization.minimize = true
    
    // Optimiser les modules Three.js
    config.module.rules.push({
      test: /three\/examples\/jsm/,
      sideEffects: false,
    })

    return config
  },

  // Headers pour la performance et la sécurité
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, must-revalidate'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ]
  },

  // Aucun redirect global `/api/*` : les route handlers Next.js, notamment
  // `/api/cfd/import`, doivent être exécutés localement et proxyfier eux-mêmes
  // vers les routes backend versionnées.
};

export default nextConfig;

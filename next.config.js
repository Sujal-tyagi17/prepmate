/** @type {import('next').NextConfig} */
process.env.NEXT_TELEMETRY_DISABLED = '1';
const path = require('path');

// E2E=1 swaps Clerk + Supabase for in-memory test stand-ins (tests/e2e/support). Never set this in production.
const E2E = process.env.E2E === '1';

const nextConfig = {
    webpack: (config) => {
        if (E2E) {
            const stub = (f) => path.resolve(__dirname, 'tests/e2e/support', f);
            Object.assign(config.resolve.alias, {
                '@clerk/nextjs$': stub('clerk.js'),
                '@clerk/nextjs/server$': stub('clerk-server.js'),
                '@/lib/supabase/server$': stub('supabase-server.ts'),
                [path.resolve(__dirname, 'lib/supabase/server')]: stub('supabase-server.ts'),
            });
        }
        return config;
    },
    reactStrictMode: true,
    compress: true,
    poweredByHeader: false,
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256],
        minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
        domains: ['localhost', 'res.cloudinary.com'],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
        optimizePackageImports: ['lucide-react', 'framer-motion'],
    },
    headers: async () => [
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            ],
        },
        {
            source: '/(.*)\\.(js|css|woff2|png|jpg|webp|avif|svg|ico)',
            headers: [
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
            ],
        },
    ],
};

module.exports = nextConfig;

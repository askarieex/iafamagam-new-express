/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Disable file system cache
    experimental: {
        // Disable default cache
        disableOptimizedLoading: true,
        // Disable static page generation cache
        optimizeCss: false
    },
    webpack: (config, { isServer }) => {
        // Disable webpack caching
        config.cache = false;
        return config;
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3001/api/:path*',
            },
        ];
    },
};

module.exports = nextConfig; 
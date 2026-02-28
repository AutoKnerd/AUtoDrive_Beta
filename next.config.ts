import type {NextConfig} from 'next';
import { execSync } from 'node:child_process';
import path from 'path';

function resolveGitSha() {
  const envSha =
    process.env.NEXT_PUBLIC_GIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.COMMIT_SHA ??
    process.env.GITHUB_SHA;

  if (envSha) {
    return envSha.slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
  outputFileTracingRoot: path.resolve(__dirname),
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.npm_package_version ?? '0.0.0',
    NEXT_PUBLIC_GIT_SHA: resolveGitSha(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

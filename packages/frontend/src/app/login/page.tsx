'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Animated favicon-style icon that "forms" on load
function AnimatedFeedIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} relative`}>
      <svg
        viewBox="0 0 512 512"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background - fades in first */}
        <rect
          width="512"
          height="512"
          rx="64"
          fill="#245B63"
          className="animate-fade-in"
          style={{
            opacity: 0,
            animation: 'fadeIn 0.4s ease-out forwards'
          }}
        />

        {/* News card - slides up */}
        <rect
          x="96"
          y="96"
          width="256"
          height="320"
          rx="32"
          ry="32"
          fill="#F6F2E9"
          style={{
            opacity: 0,
            transform: 'translateY(20px)',
            animation: 'slideUp 0.4s ease-out 0.2s forwards'
          }}
        />

        {/* "FEED" text - fades in */}
        <text
          x="224"
          y="160"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="56"
          fontWeight="700"
          fill="#245B63"
          style={{
            opacity: 0,
            animation: 'fadeIn 0.3s ease-out 0.5s forwards'
          }}
        >
          FEED
        </text>

        {/* Feature block - slides in */}
        <rect
          x="128"
          y="184"
          width="192"
          height="72"
          rx="8"
          ry="8"
          fill="#E3D9C7"
          style={{
            opacity: 0,
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            animation: 'scaleIn 0.4s ease-out 0.6s forwards'
          }}
        />

        {/* Lines of text - draw in sequentially */}
        <rect
          x="128"
          y="276"
          width="192"
          height="16"
          rx="8"
          ry="8"
          fill="#D0C4AF"
          style={{
            opacity: 0,
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            animation: 'scaleIn 0.3s ease-out 0.8s forwards'
          }}
        />
        <rect
          x="128"
          y="308"
          width="192"
          height="16"
          rx="8"
          ry="8"
          fill="#D0C4AF"
          style={{
            opacity: 0,
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            animation: 'scaleIn 0.3s ease-out 0.95s forwards'
          }}
        />
        <rect
          x="128"
          y="340"
          width="144"
          height="16"
          rx="8"
          ry="8"
          fill="#D0C4AF"
          style={{
            opacity: 0,
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            animation: 'scaleIn 0.3s ease-out 1.1s forwards'
          }}
        />
      </svg>

      <style jsx>{`
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding Showcase (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        {/* Ambient Blur Orbs */}
        <div className="absolute top-1/3 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full w-full p-10 xl:p-14">
          {/* Top Section - Logo & Branding */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <AnimatedFeedIcon className="w-12 h-12 rounded-lg" />
              <span className="text-white text-xl font-semibold">NewsFeed</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Your Personal
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Knowledge Stream
              </span>
            </h1>
            <p className="mt-4 text-slate-400 text-lg max-w-md leading-relaxed">
              A unified hub that consolidates all your data sources into one seamless feed. Stay organized, stay informed.
            </p>
          </div>

          {/* Bottom Section - Features */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-slate-300 text-sm">Real-time sync across all sources</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-slate-300 text-sm">Secure cloud sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-950 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <AnimatedFeedIcon className="w-10 h-10 rounded-lg" />
            <span className="text-white text-xl font-semibold">NewsFeed</span>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-2 text-slate-400">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-300">
                Email
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-12 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-12 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg transition-all"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

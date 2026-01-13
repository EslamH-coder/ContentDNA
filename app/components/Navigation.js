'use client';

import Link from 'next/link';
import { UserMenu } from '@/components/UserMenu';

export default function Navigation() {

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 mb-8">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900 dark:text-white">
            Channel Brain
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/signals"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Signals Feed
            </Link>
            <Link
              href="/dna"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              DNA Visualization
            </Link>
            <Link
              href="/videos/import"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Import Videos
            </Link>
            <Link
              href="/competitors"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              🎯 Competitors
            </Link>
            <Link
              href="/intel"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              🧠 Intelligence
            </Link>
            <Link
              href="/intelligence"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              📊 Content Intelligence
            </Link>
            <Link
              href="/content-tools"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              🛠️ Content Tools
            </Link>
            <Link
              href="/story-ideas"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              📚 Story Ideas
            </Link>
            <Link
              href="/onboarding"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg"
            >
              ➕ Add New Show
            </Link>
            
            {/* User Menu */}
            <div className="pl-6 border-l border-gray-200 dark:border-gray-700">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}


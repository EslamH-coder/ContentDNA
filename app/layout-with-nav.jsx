'use client';

import { Suspense } from 'react';
import Navigation from '@/components/Navigation';

export default function LayoutWithNav({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="h-16 bg-white border-b" />}>
        <Navigation />
      </Suspense>
      <main>{children}</main>
    </div>
  );
}




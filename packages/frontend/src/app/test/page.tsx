'use client';

import { useState } from 'react';

export default function TestPage() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>
      <p className="mb-4">If you can see this and click the button, the app is working.</p>
      
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white"
      >
        Clicked {count} times
      </button>

      <div className="mt-8 space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="p-4 bg-neutral-900 rounded">
            <p>Scroll test item {i + 1}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


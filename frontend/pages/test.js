import React, { useState } from 'react';

export default function TestPage() {
    const [count, setCount] = useState(0);

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Test Page</h1>
            <p>Count: {count}</p>
            <button
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
                onClick={() => setCount(count + 1)}
            >
                Increment
            </button>
        </div>
    );
} 
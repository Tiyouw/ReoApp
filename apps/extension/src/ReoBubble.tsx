import React, { useState, useEffect } from 'react';

export function ReoBubble() {
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    // Distraction detection simulation
    const url = window.location.href;
    if (url.includes('youtube.com') || url.includes('twitter.com')) {
      fetch('http://localhost:3000/api/reo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'jowo', context: `User is slacking on ${url}` })
      })
      .then(res => res.json())
      .then(data => setMessage(data.message));
    }
  }, []);

  return (
    <div>
      {message && <div className="reo-bubble">{message}</div>}
      <div className="reo-blob">👁️</div>
    </div>
  );
}

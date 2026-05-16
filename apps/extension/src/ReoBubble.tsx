import React, { useState, useEffect } from 'react';

export function ReoBubble() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const triggerReo = (reason) => {
    setIsLoading(true);
    chrome.runtime.sendMessage({ action: 'fetchChat', context: reason }, (response) => {
      setIsLoading(false);
      if (chrome.runtime.lastError || !response || !response.success) {
        setMessage('Bzzz... Koneksi API error dari Background Script.');
      } else {
        setMessage(response.message);
      }
    });
  };

  useEffect(() => {
    let timeoutId;
    const url = window.location.href;
    const isDistractive = url.includes('youtube.com') || url.includes('twitter.com') || url.includes('x.com') || url.includes('instagram.com');
    
    if (isDistractive) {
      // Auto-nudge after 10 seconds of being on the site
      timeoutId = setTimeout(() => {
        triggerReo(`User has been slacking on ${url} for too long!`);
      }, 10000);
    }
    return () => clearTimeout(timeoutId);
  }, []);

  // Auto-hide message after 15 seconds
  useEffect(() => {
    if (message) {
      const hideId = setTimeout(() => setMessage(''), 15000);
      return () => clearTimeout(hideId);
    }
  }, [message]);

  return (
    <>
      {message && <div className="reo-bubble">{message}</div>}
      <div className="reo-blob" onClick={() => triggerReo("User poked Reo manually.")}>
        <img 
          src={chrome.runtime.getURL('mascot.png')} 
          alt="Reo Mascot" 
          style={{ opacity: isLoading ? 0.7 : 1, filter: isLoading ? 'grayscale(50%)' : 'none' }}
        />
      </div>
    </>
  );
}

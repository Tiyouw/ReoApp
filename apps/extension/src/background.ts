chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'fetchChat') {
    fetch('http://localhost:3333/api/reo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: request.context })
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, message: data.message }))
    .catch(err => sendResponse({ success: false, error: err.message }));
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

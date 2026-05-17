fetch("http://localhost:3333/api/reo/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ context: "I am watching youtube" })
}).then(r => r.json()).then(console.log).catch(console.error);

fetch("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyABVhr8rl501J5FM_btOapKmtrw5LdbKEM")
  .then(r => r.json())
  .then(data => {
    if (data.models) {
      console.log("AVAILABLE MODELS:");
      data.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).forEach(m => console.log(m.name));
    } else {
      console.log("ERROR or NO MODELS:", data);
    }
  })
  .catch(console.error);

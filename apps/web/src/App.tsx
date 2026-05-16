import React, { useState, useEffect } from 'react';

// We will use the uploaded image as the mascot
const ReoMascot = ({ className = "w-full h-full" }) => (
  <img 
    src="/mascot.png" 
    alt="Reo Mascot" 
    className={`${className} object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300`} 
  />
);

export default function App() {
  const [persona, setPersona] = useState('jowo');
  const [task, setTask] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://reo-backend-287020541953.us-central1.run.app/api/reo/state')
      .then(res => res.json())
      .then(data => {
        setPersona(data.persona);
        setTask(data.task);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = () => {
    fetch('https://reo-backend-287020541953.us-central1.run.app/api/reo/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, task })
    }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center font-bold text-2xl text-black">
        Waking Reo up...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16">
            <ReoMascot />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-black">
            Reo.
          </h1>
        </div>
        <div className="bg-yellow border-4 border-black font-bold px-4 py-2 rounded-xl shadow-brutal-hover transform rotate-2">
          Beta
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Main Hero Card (Span 8) */}
        <div className="bento-card md:col-span-8 flex flex-col md:flex-row items-center gap-8 bg-[#FFF9E6]">
          <div className="flex-1">
            <h2 className="text-4xl font-black mb-4 leading-tight">
              Your buddy <br/>for getting things done.
            </h2>
            <p className="text-lg font-medium text-black/80 mb-8 max-w-md">
              Reo keeps you focused, accountable, and moving forward—together. 
              No more doomscrolling.
            </p>
          </div>
          <div className="w-64 h-64 flex-shrink-0 animate-bounce" style={{ animationDuration: '3s' }}>
            <ReoMascot />
          </div>
        </div>

        {/* Small Purple Accent Card (Span 4) */}
        <div className="bento-card-purple md:col-span-4 flex flex-col justify-center text-center">
          <div className="text-6xl mb-4">✨</div>
          <h3 className="text-3xl font-black leading-tight">
            Less<br/>procrastinating.<br/>More finishing.
          </h3>
        </div>

        {/* Control Panel: Task Input (Span 7) */}
        <div className="bento-card md:col-span-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">1</div>
            <h3 className="text-2xl font-black">Set Your Target</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            <label htmlFor="task-input" className="font-bold text-lg">What are you working on right now?</label>
            <input 
              id="task-input"
              value={task} 
              onChange={(e) => setTask(e.target.value)} 
              placeholder="e.g. Writing my thesis chapter 2"
              className="input-brutal text-lg w-full"
            />
            <p className="text-black/60 font-medium text-sm">
              Reo will remind you about this specifically when you slack off.
            </p>
          </div>
        </div>

        {/* Control Panel: Persona (Span 5) */}
        <div className="bento-card bg-[#E0E7FF] md:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">2</div>
              <h3 className="text-2xl font-black"><label htmlFor="persona-select">Pick a Vibe</label></h3>
            </div>

            <div className="relative">
              <select 
                id="persona-select"
                value={persona} 
                onChange={(e) => setPersona(e.target.value)}
                className="input-brutal w-full text-lg appearance-none cursor-pointer"
              >
                <option value="jowo">Savage Jowo (Galak)</option>
                <option value="jaksel">Anak Jaksel (Sok Asik)</option>
                <option value="professional">Professional (Kaku)</option>
              </select>
              <div className="absolute right-5 top-4 pointer-events-none text-black font-black">
                ▼
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave} 
            className="btn-brutal w-full mt-8 text-xl flex items-center justify-center gap-2"
          >
            {saved ? 'Saved! 🚀' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}

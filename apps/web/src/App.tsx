import React, { useState } from 'react';

export default function App() {
  const [persona, setPersona] = useState('jowo');
  const [task, setTask] = useState('');

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Reo Dashboard ⚙️</h1>
      <div>
        <h3>Current Persona</h3>
        <select value={persona} onChange={(e) => setPersona(e.target.value)}>
          <option value="jowo">Savage Jowo</option>
          <option value="jaksel">Anak Jaksel</option>
          <option value="professional">Professional</option>
        </select>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h3>Current Task</h3>
        <input 
          value={task} 
          onChange={(e) => setTask(e.target.value)} 
          placeholder="What are you working on?"
          style={{ padding: '0.5rem', width: '300px' }}
        />
        <button style={{ marginLeft: '1rem', padding: '0.5rem' }}>Set Task</button>
      </div>
    </div>
  );
}

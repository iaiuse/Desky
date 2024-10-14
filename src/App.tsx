import { useState } from 'react';
import { invoke } from "@tauri-apps/api/tauri";
import VideoFeed from './components/VideoFeed';
import ServoControls from './components/ServoControls';
import ConfigPanel from './components/ConfigPanel';
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="container">
      <h1>Welcome to Desky</h1>
      
      <div className="row">
        <VideoFeed />
        <ServoControls />
      </div>
      
      <ConfigPanel />

      <p>Click below to test Tauri command invocation:</p>
      <div className="row">
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button onClick={greet}>Greet</button>
      </div>
      <p>{greetMsg}</p>
    </div>
  );
}

export default App;
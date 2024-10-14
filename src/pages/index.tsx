import React, { useState } from 'react';
import VideoFeed from '../components/VideoFeed';
import ServoControls from '../components/ServoControls';
import { generateResponse, generateSpeech } from '../lib/openai';

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [kaomoji, setKaomoji] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await generateResponse(input);
      setResponse(result.response);
      setKaomoji(result.kaomoji);
      
      // Generate and play speech
      const audioBuffer = await generateSpeech(result.response);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();

      // Update servo positions
      // This would typically be handled by the ServoControls component
      // but you might want to add some logic here to update based on the response
    } catch (error) {
      console.error('Error processing request:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Desky</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <VideoFeed />
        </div>
        <div>
          <ServoControls />
          <form onSubmit={handleSubmit} className="mt-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Enter your message"
            />
            <button type="submit" className="mt-2 p-2 bg-blue-500 text-white rounded">
              Send
            </button>
          </form>
          <div className="mt-4">
            <p>Response: {response}</p>
            <p>Kaomoji: {kaomoji}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
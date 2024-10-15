import React, { useState, useEffect } from 'react';
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { logger } from '../utils/logger';

interface ScriptInputProps {
  initialScript: string;
  onScriptSubmit: (script: string) => Promise<void>;
  isLoading: boolean;
}

export const ScriptInput: React.FC<ScriptInputProps> = ({ initialScript, onScriptSubmit, isLoading }) => {
  const [script, setScript] = useState(initialScript);
  const [wordCount, setWordCount] = useState(0);
  const ModelName = "ScriptInput";

  useEffect(() => {
    //logger.log(`Initial script received: ${initialScript.substring(0, 50)}...`, 'INFO', ModelName);
    setScript(initialScript);
  }, [initialScript]);

  useEffect(() => {
    const words = script.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
    //logger.log(`Word count updated: ${words.length}`, 'INFO');
  }, [script]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newScript = e.target.value;
    setScript(newScript);
    //logger.log(`Script updated. New length: ${newScript.length} characters`, 'INFO');
  };

  const handleSubmit = async () => {
    if (script.trim() !== '') {
      try {
        logger.log(`Submitting script for processing. Script length: ${script.length} characters, ${script}`, 'INFO', ModelName);
        await onScriptSubmit(script);
        logger.log('Script submitted successfully', 'INFO', ModelName);
      } catch (error) {
        logger.log(`Error processing script: ${error}`, 'ERROR');
        // Handle error (e.g., show an error message to the user)
      }
    } else {
      logger.log('Attempted to submit empty script', 'WARN');
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={script}
        onChange={handleChange}
        placeholder="Enter your script here..."
        rows={10}
      />
      <div>Word count: {wordCount}</div>
      <Button onClick={handleSubmit} disabled={isLoading || script.trim() === ''}>
        {isLoading ? 'Processing...' : 'Submit Script'}
      </Button>
    </div>
  );
};
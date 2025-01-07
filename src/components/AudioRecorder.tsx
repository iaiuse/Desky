import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { logger } from '../utils/logger';
import { uploadAudioFile } from '@/lib/tts';

interface AudioRecorderProps {
  onVoiceCloned: (voiceId: string) => void;
  maxDuration?: number;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onVoiceCloned,
  maxDuration = 300
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<number>();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/wav' });
        const file = new File([blob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
        try {
          const voiceId = await uploadAudioFile(file, 'voice_clone');
          onVoiceCloned(voiceId);
        } catch (error) {
          logger.log(`音频上传失败: ${error}`, 'ERROR', 'AudioRecorder');
          alert('音频上传失败，请重试');
        }
        
        chunks.current = [];
        setDuration(0);
      };

      mediaRecorder.current.start();
      setIsRecording(true);

      // 开始计时
      timerRef.current = window.setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      logger.log(`录音失败: ${error}`, 'ERROR', 'AudioRecorder');
      throw new Error('无法访问麦克风');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4">
      {isRecording ? (
        <Button
          variant="destructive"
          onClick={stopRecording}
          className="gap-2"
        >
          <Square className="h-4 w-4" />
          停止录音 ({formatTime(duration)})
        </Button>
      ) : (
        <Button
          onClick={startRecording}
          className="gap-2"
        >
          <Mic className="h-4 w-4" />
          开始录音
        </Button>
      )}
    </div>
  );
};

export default AudioRecorder; 
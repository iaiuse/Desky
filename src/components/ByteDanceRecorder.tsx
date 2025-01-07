import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadAudioFile } from '../lib/bytedanceTts';
import { logger } from '../utils/logger';

const ModelName = "ByteDanceRecorder";

interface ByteDanceRecorderProps {
  onVoiceCloned: (voiceId: string) => void;
}

export function ByteDanceRecorder({ onVoiceCloned }: ByteDanceRecorderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      logger.log(`Starting file upload: ${file.name}`, 'INFO', ModelName);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const fileId = await uploadAudioFile(file, 'voice_clone');
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      logger.log(`File uploaded successfully, fileId: ${fileId}`, 'INFO', ModelName);
      onVoiceCloned(fileId);

    } catch (error) {
      logger.log(`File upload failed: ${error}`, 'ERROR', ModelName);
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="audio/*"
        className="hidden"
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        variant="outline"
        className="w-full"
      >
        {isUploading ? '上传中...' : '选择音频文件'}
      </Button>
      {isUploading && (
        <Progress value={uploadProgress} className="w-full" />
      )}
      <div className="text-sm text-gray-500">
        支持的格式：wav、mp3、ogg、m4a、aac、pcm
        <br />
        单个文件最大10MB
      </div>
    </div>
  );
} 
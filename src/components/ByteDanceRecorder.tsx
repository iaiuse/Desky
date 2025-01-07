import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadAudioFile } from '../lib/bytedanceTts';
import { logger } from '../utils/logger';

const ModelName = "ByteDanceRecorder";

interface ByteDanceRecorderProps {
  onVoiceCloned: (voiceId: string) => void;
}

type Language = 0 | 1 | 2 | 3 | 4 | 5;

const LANGUAGE_OPTIONS = [
  { value: 0, label: '中文' },
  { value: 1, label: '英文' },
  { value: 2, label: '日语' },
  { value: 3, label: '西班牙语' },
  { value: 4, label: '印尼语' },
  { value: 5, label: '葡萄牙语' }
];

export function ByteDanceRecorder({ onVoiceCloned }: ByteDanceRecorderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 配置选项
  const [language, setLanguage] = useState<Language>(0);
  const [modelType, setModelType] = useState(1); // 1为2.0效果，0为1.0效果
  const [textValidation, setTextValidation] = useState('');
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [volumeNormalization, setVolumeNormalization] = useState(true);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件大小
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过10MB');
      return;
    }

    // 验证文件格式
    const validFormats = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac'];
    if (!validFormats.includes(file.type)) {
      alert('只支持 mp3、wav、ogg、m4a、aac 格式');
      return;
    }

    try {
      setIsUploading(true);
      logger.log(`Starting file upload: ${file.name}`, 'INFO', ModelName);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const voiceId = await uploadAudioFile(file, {
        language,
        modelType,
        textValidation,
        noiseReduction,
        volumeNormalization
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      logger.log(`File uploaded successfully, voiceId: ${voiceId}`, 'INFO', ModelName);
      onVoiceCloned(voiceId);

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
    <div className="space-y-6">
      <div className="space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".mp3,.wav,.ogg,.m4a,.aac"
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
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>语言选择</Label>
          <Select
            value={language.toString()}
            onValueChange={(value) => setLanguage(parseInt(value) as Language)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择语言" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            请选择音频对应的语言，以获得更好的复刻效果
          </div>
        </div>

        <div className="space-y-2">
          <Label>文本验证</Label>
          <Textarea
            value={textValidation}
            onChange={(e) => setTextValidation(e.target.value)}
            placeholder="输入音频对应的文本内容，用于验证音频质量（可选，最多200字）"
            maxLength={200}
          />
          <div className="text-sm text-muted-foreground">
            如果提供文本，系统会对比音频与文本的差异，确保音频质量
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>降噪处理</Label>
            <div className="text-sm text-muted-foreground">
              自动去除背景噪音
            </div>
          </div>
          <Switch
            checked={noiseReduction}
            onCheckedChange={setNoiseReduction}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>音量标准化</Label>
            <div className="text-sm text-muted-foreground">
              自动调整音量到合适水平
            </div>
          </div>
          <Switch
            checked={volumeNormalization}
            onCheckedChange={setVolumeNormalization}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>使用2.0版本</Label>
            <div className="text-sm text-muted-foreground">
              2.0版本提供更好的声音复刻效果
            </div>
          </div>
          <Switch
            checked={modelType === 1}
            onCheckedChange={(checked) => setModelType(checked ? 1 : 0)}
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        注意：
        <ul className="list-disc pl-4 space-y-1">
          <li>上传的音频时长应在10秒到5分钟之间</li>
          <li>文件大小不超过10MB</li>
          <li>支持mp3、wav、ogg、m4a、aac格式</li>
          <li>复刻的音色将在7天内未使用时自动删除</li>
          <li>使用2.0版本时，请确保音频语言与选择的语言一致</li>
        </ul>
      </div>
    </div>
  );
} 
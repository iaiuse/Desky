import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Square, Upload } from "lucide-react";
import { logger } from '../utils/logger';
import { uploadAudioFile } from '@/lib/tts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface AudioRecorderProps {
  onVoiceCloned: (voiceId: string) => void;
  maxDuration?: number;
}

interface ClonePrompt {
  promptAudio?: File;
  promptText?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onVoiceCloned,
  maxDuration = 300
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 配置选项
  const [accuracy, setAccuracy] = useState(0.5); // 准确度 0-1
  const [noiseReduction, setNoiseReduction] = useState(true); // 降噪
  const [volumeNormalization, setVolumeNormalization] = useState(true); // 音量标准化

  // 新增配置选项
  const [textValidation, setTextValidation] = useState('');
  const [clonePrompt, setClonePrompt] = useState<ClonePrompt>({});
  const [promptFileInputRef] = useState(useRef<HTMLInputElement>(null));
  const [previewText, setPreviewText] = useState('');
  const [previewAudio, setPreviewAudio] = useState<string>('');

  const handlePromptFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setClonePrompt(prev => ({
      ...prev,
      promptAudio: file
    }));
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件大小
    if (file.size > 20 * 1024 * 1024) {
      alert('文件大小不能超过20MB');
      return;
    }

    // 验证文件格式
    const validFormats = ['audio/mp3', 'audio/wav', 'audio/x-m4a'];
    if (!validFormats.includes(file.type)) {
      alert('只支持 mp3、wav、m4a 格式');
      return;
    }

    try {
      // 创建文件预览URL
      const previewUrl = URL.createObjectURL(file);
      setPreviewAudio(previewUrl);

      setIsUploading(true);
      logger.log(`Starting file upload: ${file.name}`, 'INFO', 'AudioRecorder');

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const voiceId = await uploadAudioFile(file, 'voice_clone'
      );
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      logger.log(`File uploaded successfully, voiceId: ${voiceId}`, 'INFO', 'AudioRecorder');
      onVoiceCloned(voiceId);

    } catch (error) {
      logger.log(`File upload failed: ${error}`, 'ERROR', 'AudioRecorder');
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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

  // 在组件卸载时清理预览URL
  useEffect(() => {
    return () => {
      if (previewAudio) {
        URL.revokeObjectURL(previewAudio);
      }
    };
  }, [previewAudio]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="record">实时录音</TabsTrigger>
          <TabsTrigger value="upload">文件上传</TabsTrigger>
        </TabsList>
        
        <TabsContent value="record" className="space-y-4">
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
          <div className="text-sm text-muted-foreground">
            最长录音时间：{Math.floor(maxDuration / 60)}分钟
          </div>
        </TabsContent>
        
        <TabsContent value="upload" className="space-y-4">
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
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? '上传中...' : '选择音频文件'}
          </Button>
          {isUploading && (
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            支持的格式：wav、mp3、ogg、m4a、aac
            <br />
            建议使用清晰的人声录音，避免背景噪音
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-4 pt-4 border-t">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>声音复刻准确度</Label>
            <span className="text-sm text-muted-foreground">{Math.round(accuracy * 100)}%</span>
          </div>
          <Slider
            value={[accuracy * 100]}
            onValueChange={([value]) => setAccuracy(value / 100)}
            max={100}
            step={1}
          />
          <div className="text-sm text-muted-foreground">
            准确度越高，声音复刻效果越好，但训练时间可能更长
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

        <div className="space-y-2">
          <Label>示例音频（可选）</Label>
          <div className="space-y-2">
            <input
              type="file"
              ref={promptFileInputRef}
              onChange={handlePromptFileSelect}
              accept="audio/mp3,audio/wav,audio/x-m4a"
              className="hidden"
            />
            <Button
              onClick={() => promptFileInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              选择示例音频（小于8秒）
            </Button>
            {clonePrompt.promptAudio && (
              <div className="text-sm">
                已选择: {clonePrompt.promptAudio.name}
              </div>
            )}
            <Input
              value={clonePrompt.promptText}
              onChange={(e) => setClonePrompt(prev => ({
                ...prev,
                promptText: e.target.value
              }))}
              placeholder="输入示例音频对应的文本内容"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            上传一小段示例音频及对应文本，有助于增强语音合成的音色相似度和稳定性
          </div>
        </div>

        <div className="space-y-2">
          <Label>试听文本（可选）</Label>
          <Textarea
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="输入要试听的文本内容（最多300字）"
            maxLength={300}
          />
          {previewAudio && (
            <audio controls src={previewAudio} className="w-full" />
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        注意：
        <ul className="list-disc pl-4 space-y-1">
          <li>上传的音频时长应在10秒到5分钟之间</li>
          <li>文件大小不超过20MB</li>
          <li>支持mp3、wav、m4a格式</li>
          <li>复刻的音色将在7天内未使用时自动删除</li>
        </ul>
      </div>
    </div>
  );
};

export default AudioRecorder; 
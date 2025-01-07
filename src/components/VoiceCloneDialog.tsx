import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { logger } from '../utils/logger';
import AudioPlayer from './AudioPlayer';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { uploadAudioFile, cloneVoice, generateSpeech } from '../lib/tts';

const ModelName = "VoiceCloneDialog";

interface VoiceCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoiceCloned: (voiceId: string, name: string) => void;
}

async function validateAudioFile(file: File, isPromptAudio: boolean = false): Promise<{ valid: boolean; error?: string }> {
  // Check file format
  const validFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];
  if (!validFormats.includes(file.type)) {
    return { valid: false, error: '请上传 mp3、m4a 或 wav 格式的音频文件' };
  }

  // Check file size (20MB = 20 * 1024 * 1024 bytes)
  if (file.size > 20 * 1024 * 1024) {
    return { valid: false, error: '音频文件大小不能超过 20MB' };
  }

  // Check audio duration
  try {
    const audio = new Audio();
    const reader = new FileReader();
    
    const duration = await new Promise<number>((resolve, reject) => {
      reader.onload = (e) => {
        audio.src = e.target?.result as string;
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject(new Error('无法读取音频文件'));
      };
      reader.onerror = () => reject(new Error('无法读取文件'));
      reader.readAsDataURL(file);
    });

    if (isPromptAudio) {
      if (duration > 8) {
        return { valid: false, error: '示例音频不能超过 8 秒' };
      }
    } else {
      if (duration < 10) {
        return { valid: false, error: '音频时长不能少于 10 秒' };
      }
      if (duration > 300) { // 5 minutes = 300 seconds
        return { valid: false, error: '音频时长不能超过 5 分钟' };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: '音频文件验证失败' };
  }
}

// Add new state for notifications
interface Notification {
  id: number;
  type: 'error' | 'success';
  message: string;
}

export const VoiceCloneDialog: React.FC<VoiceCloneDialogProps> = ({
  open,
  onOpenChange,
  onVoiceCloned
}) => {
  const [voiceName, setVoiceName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [promptAudioFile, setPromptAudioFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');
  const [accuracy, setAccuracy] = useState(0.8);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [volumeNormalization, setVolumeNormalization] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<ArrayBuffer | null>(null);
  const [previewText, setPreviewText] = useState('一闪一闪亮晶晶，满天都是小星星。');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Replace handleError and handleSuccess with a single notification handler
  const addNotification = (message: string, type: 'error' | 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    
    // 延长显示时间到 8 秒
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  };
  
  const handleError = (error: any) => {
    const message = typeof error === 'string' ? error : error.message;
    addNotification(message, 'error');
  };

  // Update success handling
  const handleSuccess = (message: string) => {
    addNotification(message, 'success');
  };

  const handleSubmit = async () => {
    try {
      if (!audioFile || !voiceName) {
        throw new Error('Please provide both voice name and audio file');
      }

      setIsLoading(true);

      // 生成唯一的voice_id
      const voiceId = `custom-${Date.now()}-${voiceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      // 上传主音频文件
      const fileId = await uploadAudioFile(audioFile, 'voice_clone');

      // 如果有示例音频和文本，上传示例音频
      let promptAudio;
      if (promptAudioFile && promptText) {
        const promptFileId = await uploadAudioFile(promptAudioFile, 'prompt_audio');
        promptAudio = {
          fileId: promptFileId,
          text: promptText
        };
      }

      // 克隆声音
      await cloneVoice({
        fileId,
        voiceId,
        accuracy,
        noiseReduction,
        volumeNormalization,
        promptAudio
      });

      onVoiceCloned(voiceId, voiceName);
      onOpenChange(false);
      handleSuccess('声音复刻成功！');
      
      // 清理表单
      setVoiceName('');
      setAudioFile(null);
      setPromptAudioFile(null);
      setPromptText('');

    } catch (error) {
      logger.log(`Error cloning voice: ${error}`, 'ERROR', ModelName);
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    try {
      if (!voiceName) {
        logger.log('请先输入语音名称', 'WARN', ModelName);
        return;
      }

      setIsLoading(true);
      logger.log(`开始生成试听音频，使用文本: ${previewText}`, 'INFO', ModelName);

      // 生成唯一的voice_id
      const voiceId = `custom-${Date.now()}-${voiceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      logger.log(`使用voice_id: ${voiceId}`, 'DEBUG', ModelName);

      const audioBuffer = await generateSpeech(previewText, voiceId);
      setPreviewAudio(audioBuffer);

    } catch (error) {
      logger.log(`试听音频生成失败: ${error}`, 'ERROR', ModelName);
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMainAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateAudioFile(file);
    if (!validation.valid) {
      handleError(validation.error);
      e.target.value = ''; // Clear the input
      setAudioFile(null);
      return;
    }

    setAudioFile(file);
  };

  const handlePromptAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateAudioFile(file, true);
    if (!validation.valid) {
      handleError(validation.error);
      e.target.value = ''; // Clear the input
      setPromptAudioFile(null);
      return;
    }

    setPromptAudioFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>复刻新语音</DialogTitle>
          <DialogDescription>
            上传音频文件来创建一个新的语音克隆。建议使用清晰的人声录音，避免背景噪音。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 my-4">
          {notifications.map(notification => (
            <Alert
              key={notification.id}
              variant={notification.type === 'error' ? 'destructive' : 'default'}
              className="animate-slide-in-right"
            >
              <AlertDescription className="break-words">
                {notification.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="voice-name">语音名称</Label>
            <Input
              id="voice-name"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="输入语音名称（如：我的声音-1）"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="audio-file" className="flex items-center gap-2">
              主要音频文件 <Info className="w-4 h-4" />
            </Label>
            <div className="text-sm text-muted-foreground mb-2">
              上传10秒到5分钟的清晰录音，这将作为声音复刻的主要来源。
            </div>
            <Input
              id="audio-file"
              type="file"
              accept=".mp3,.m4a,.wav"
              onChange={handleMainAudioFileChange}
            />
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              高级设置
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="prompt-audio" className="flex items-center gap-2">
                  示例音频 <Info className="w-4 h-4" />
                </Label>
                <div className="text-sm text-muted-foreground mb-2">
                  可选：上传一段不超过8秒的音频片段，用于指定具体的语气和风格。
                </div>
                <Input
                  id="prompt-audio"
                  type="file"
                  accept=".mp3,.m4a,.wav"
                  onChange={handlePromptAudioFileChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="prompt-text">示例文本</Label>
                <div className="text-sm text-muted-foreground mb-2">
                  输入示例音频对应的文本内容，帮助模型更好地理解语音特征。
                </div>
                <Input
                  id="prompt-text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="输入示例音频中说的内容"
                />
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  准确率: {accuracy} <Info className="w-4 h-4" />
                </Label>
                <div className="text-sm text-muted-foreground mb-2">
                  较高的准确率可能产生更相似的声音，但可能会降低合成语音的流畅度。
                </div>
                <Slider
                  value={[accuracy]}
                  onValueChange={([value]) => setAccuracy(value)}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="noise-reduction">降噪</Label>
                  <div className="text-sm text-muted-foreground">
                    减少背景噪音，提高声音清晰度
                  </div>
                </div>
                <Switch
                  id="noise-reduction"
                  checked={noiseReduction}
                  onCheckedChange={setNoiseReduction}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="volume-normalization">音量归一化</Label>
                  <div className="text-sm text-muted-foreground">
                    统一调整音量水平
                  </div>
                </div>
                <Switch
                  id="volume-normalization"
                  checked={volumeNormalization}
                  onCheckedChange={setVolumeNormalization}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid gap-2">
            <Label>试听文本</Label>
            <div className="text-sm text-muted-foreground mb-2">
              输入文本来试听复刻后的声音效果。
            </div>
            <Textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="输入要试听的文本"
            />
            <Button 
              onClick={handlePreview} 
              disabled={isLoading || !voiceName}
              variant="secondary"
            >
              {isLoading ? '生成中...' : '生成试听'}
            </Button>
          </div>

          {previewAudio && (
            <div className="grid gap-2">
              <Label>试听音频</Label>
              <AudioPlayer audioBuffer={previewAudio} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !voiceName || !audioFile}
          >
            {isLoading ? '处理中...' : '确认'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 
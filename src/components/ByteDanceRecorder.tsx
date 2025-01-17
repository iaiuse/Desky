import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadAudioFile, checkVoiceStatus, VoiceStatus, VoiceStatusResponse, VoiceInfo, listAvailableVoices } from '../lib/bytedanceTts';
import { logger } from '../utils/logger';
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [currentVoiceId, setCurrentVoiceId] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<VoiceStatusResponse | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [loadVoicesError, setLoadVoicesError] = useState<string | null>(null);

  // 配置选项
  const [language, setLanguage] = useState<Language>(0);
  const [modelType, setModelType] = useState(1); // 1为2.0效果，0为1.0效果
  const [textValidation, setTextValidation] = useState('');
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [volumeNormalization, setVolumeNormalization] = useState(true);

  // 加载可用音色列表
  useEffect(() => {
    async function loadVoices() {
      try {
        setIsLoadingVoices(true);
        setLoadVoicesError(null);
        logger.log('Starting to load available voices...', 'INFO', ModelName);
        
        const voices = await listAvailableVoices();
        logger.log(`Successfully loaded ${voices.length} voices`, 'INFO', ModelName);
        
        setAvailableVoices(voices);
        
        // 如果有可用音色，默认选择第一个
        if (voices.length > 0) {
          setSelectedVoiceId(voices[0].speakerId);
          logger.log(`Selected default voice: ${voices[0].speakerId}`, 'INFO', ModelName);
        } else {
          logger.log('No voices available', 'WARN', ModelName);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.log(`Failed to load voices: ${errorMessage}`, 'ERROR', ModelName);
        setLoadVoicesError(errorMessage);
        alert(`加载音色列表失败: ${errorMessage}`);
      } finally {
        setIsLoadingVoices(false);
      }
    }
    
    loadVoices();
  }, []);

  // 定期检查训练状态
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!currentVoiceId || 
          (trainingStatus?.status !== VoiceStatus.Training && 
           trainingStatus?.status !== VoiceStatus.NotFound)) {
        return;
      }

      try {
        const status = await checkVoiceStatus(currentVoiceId);
        setTrainingStatus(status);

        if (status.status === VoiceStatus.Success || status.status === VoiceStatus.Active) {
          onVoiceCloned(currentVoiceId);
        }
      } catch (error) {
        logger.log(`Failed to check voice status: ${error}`, 'ERROR', ModelName);
      }
    };

    if (currentVoiceId) {
      checkStatus();
      intervalId = setInterval(checkStatus, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentVoiceId, trainingStatus?.status]);

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

      const voiceId = await uploadAudioFile(file, selectedVoiceId, {
        language,
        modelType,
        textValidation,
        noiseReduction,
        volumeNormalization
      });
      
      setCurrentVoiceId(voiceId);
      setTrainingStatus({ status: VoiceStatus.Training });
      
      logger.log(`File uploaded successfully, voiceId: ${voiceId}`, 'INFO', ModelName);

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

  const getStatusDisplay = () => {
    if (!trainingStatus) return null;

    const statusMessages = {
      [VoiceStatus.NotFound]: '未找到音色',
      [VoiceStatus.Training]: '正在训练中...',
      [VoiceStatus.Success]: '训练成功',
      [VoiceStatus.Failed]: '训练失败',
      [VoiceStatus.Active]: '音色可用'
    };

    const statusColors = {
      [VoiceStatus.NotFound]: 'bg-gray-100',
      [VoiceStatus.Training]: 'bg-yellow-100',
      [VoiceStatus.Success]: 'bg-green-100',
      [VoiceStatus.Failed]: 'bg-red-100',
      [VoiceStatus.Active]: 'bg-green-100'
    };

    const canUseVoice = trainingStatus.status === VoiceStatus.Success || 
                       trainingStatus.status === VoiceStatus.Active;

    return (
      <Alert className={statusColors[trainingStatus.status]}>
        <AlertDescription className="space-y-2">
          <div className="flex items-center justify-between">
            <span>{statusMessages[trainingStatus.status]}</span>
            {trainingStatus.version && (
              <span className="text-sm text-muted-foreground">版本: {trainingStatus.version}</span>
            )}
          </div>
          
          {canUseVoice && (
            <>
              {trainingStatus.createTime && (
                <div className="text-sm text-muted-foreground">
                  创建时间: {new Date(trainingStatus.createTime).toLocaleString()}
                </div>
              )}
              {trainingStatus.demoAudio && (
                <div className="mt-2">
                  <Label>试听效果</Label>
                  <audio 
                    ref={audioRef} 
                    src={trainingStatus.demoAudio} 
                    controls 
                    className="w-full mt-1"
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    试听音频链接有效期为1小时
                  </div>
                </div>
              )}
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>选择音色</Label>
          {isLoadingVoices ? (
            <div className="text-sm text-muted-foreground">加载音色列表中...</div>
          ) : loadVoicesError ? (
            <div className="text-sm text-red-500">
              加载失败: {loadVoicesError}
            </div>
          ) : (
            <Select
              value={selectedVoiceId}
              onValueChange={setSelectedVoiceId}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择要使用的音色" />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map(voice => (
                  <SelectItem 
                    key={voice.speakerId} 
                    value={voice.speakerId}
                  >
                    音色 {voice.speakerId}
                    {voice.version && ` (${voice.version})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="text-sm text-muted-foreground">
            选择要使用的音色ID，每个音色有其特定的声音特征
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".mp3,.wav,.ogg,.m4a,.aac"
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !selectedVoiceId}
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

      {getStatusDisplay()}

      <div className="text-sm text-muted-foreground">
        注意：
        <ul className="list-disc pl-4 space-y-1">
          <li>上传的音频时长应在10秒到5分钟之间</li>
          <li>文件大小不超过10MB</li>
          <li>支持mp3、wav、ogg、m4a、aac格式</li>
          <li>复刻的音色将在7天内未使用时自动删除</li>
          <li>使用2.0版本时，请确保音频语言与选择的语言一致</li>
          <li>训练完成后可以试听效果</li>
          <li>训练成功后音色ID将自动保存</li>
          <li>每个音色ID代表一种独特的声音特征</li>
          <li>请先选择音色ID再上传音频文件</li>
        </ul>
      </div>
    </div>
  );
} 
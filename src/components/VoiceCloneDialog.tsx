import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AudioRecorder from './AudioRecorder';
import { ByteDanceRecorder } from './ByteDanceRecorder';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";

interface VoiceCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoiceCloned: (voiceId: string, name: string) => void;
}

type TTSProvider = 'minimax' | 'bytedance';

export function VoiceCloneDialog({
  open,
  onOpenChange,
  onVoiceCloned
}: VoiceCloneDialogProps) {
  const [voiceName, setVoiceName] = useState('');
  const [provider, setProvider] = useState<TTSProvider>('minimax');

  const handleVoiceCloned = (voiceId: string) => {
    if (voiceName.trim()) {
      onVoiceCloned(voiceId, voiceName);
      setVoiceName('');
      onOpenChange(false);
    } else {
      alert('请输入语音名称');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] min-h-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>复刻新语音</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-8">
          {/* 左侧选择区域 */}
          <div className="w-1/3 space-y-6">
            <div className="space-y-2">
              <Label>语音名称</Label>
              <Input
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="给这个语音起个名字"
              />
            </div>
            
            <div className="space-y-2">
              <Label>选择服务提供商</Label>
              <RadioGroup
                value={provider}
                onValueChange={(value: TTSProvider) => setProvider(value)}
                className="space-y-2"
              >
                <Card className={`cursor-pointer ${provider === 'minimax' ? 'border-primary' : ''}`}>
                  <CardContent className="flex items-center space-x-2 p-4">
                    <RadioGroupItem value="minimax" id="minimax" />
                    <Label htmlFor="minimax" className="cursor-pointer">
                      <div>
                        <div className="font-medium">MiniMax</div>
                        <div className="text-sm text-muted-foreground">
                          支持实时录音，高质量声音复刻
                        </div>
                      </div>
                    </Label>
                  </CardContent>
                </Card>
                
                <Card className={`cursor-pointer ${provider === 'bytedance' ? 'border-primary' : ''}`}>
                  <CardContent className="flex items-center space-x-2 p-4">
                    <RadioGroupItem value="bytedance" id="bytedance" />
                    <Label htmlFor="bytedance" className="cursor-pointer">
                      <div>
                        <div className="font-medium">字节跳动</div>
                        <div className="text-sm text-muted-foreground">
                          支持音频文件上传，快速声音复刻
                        </div>
                      </div>
                    </Label>
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>
          </div>

          {/* 右侧录音/上传区域 */}
          <div className="w-2/3 border-l pl-8">
            <div className="space-y-6">
              <h3 className="text-lg font-medium">
                {provider === 'minimax' ? '录制语音' : '上传音频'}
              </h3>
              <div className="h-[400px] rounded-lg border p-4">
                {provider === 'minimax' ? (
                  <AudioRecorder 
                    onVoiceCloned={handleVoiceCloned}
                  />
                ) : (
                  <ByteDanceRecorder 
                    onVoiceCloned={handleVoiceCloned}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
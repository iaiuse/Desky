import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AudioRecorder from './AudioRecorder';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ByteDanceRecorder } from './ByteDanceRecorder';

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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>复刻新语音</DialogTitle>
          <DialogDescription>
            上传音频来创建你自己的AI语音。建议使用清晰的人声录音，避免背景噪音。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              语音名称
            </Label>
            <Input
              id="name"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="col-span-3"
              placeholder="给这个语音起个名字"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="provider" className="text-right">
              服务提供商
            </Label>
            <Select
              value={provider}
              onValueChange={(value: TTSProvider) => setProvider(value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="选择服务提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimax">MiniMax</SelectItem>
                <SelectItem value="bytedance">字节跳动</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              录音上传
            </Label>
            <div className="col-span-3">
              {provider === 'minimax' ? (
                <AudioRecorder 
                  onVoiceCloned={handleVoiceCloned}
                />
              ) : (
                <ByteDanceRecorder onVoiceCloned={handleVoiceCloned} />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
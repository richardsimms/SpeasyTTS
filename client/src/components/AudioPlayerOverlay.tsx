import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AudioPlayerOverlayProps {
  title: string;
  content?: string;
  audioUrl?: string;
  onClose?: () => void;
}

const AudioPlayerOverlay: React.FC<AudioPlayerOverlayProps> = ({
  title,
  content,
  audioUrl,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          await audioRef.current.pause();
        } else {
          await audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
        console.error('Playback error:', error);
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 30;
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 30;
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setProgress((current / total) * 100);
      setCurrentTime(formatTime(current));
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(formatTime(audioRef.current.duration));
    }
  };

  React.useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
      });
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current.removeEventListener('ended', () => setIsPlaying(false));
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  return (
    <Card className="fixed inset-x-0 bottom-0 border-t">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="hover:bg-accent"
            >
              {isPlaying ? 
                <Pause className="h-6 w-6" /> : 
                <Play className="h-6 w-6" />
              }
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="hover:bg-accent"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="hover:bg-accent"
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            <div className="flex-1">
              <h3 className="text-sm font-medium truncate">
                {title}
              </h3>
              <div className="text-xs text-muted-foreground">
                {currentTime} / {duration}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="hover:bg-accent"
            >
              {isMuted ? 
                <VolumeX className="h-5 w-5" /> : 
                <Volume2 className="h-5 w-5" />
              }
            </Button>

            {content && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotes(!showNotes)}
                className="hover:bg-accent"
              >
                {showNotes ? 
                  <ChevronDown className="h-5 w-5" /> : 
                  <ChevronUp className="h-5 w-5" />
                }
              </Button>
            )}
          </div>
        </div>

        <Progress value={progress} className="mt-2" />
      </div>

      {showNotes && content && (
        <div className="px-4 py-3 bg-accent/50">
          <Separator className="mb-2" />
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <h4 className="text-lg font-semibold mb-2">Show Notes</h4>
            <div className="text-muted-foreground max-h-48 overflow-y-auto">
              {content}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AudioPlayerOverlay;

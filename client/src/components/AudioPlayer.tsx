import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import WaveformVisualizer from "./WaveformVisualizer";

interface AudioPlayerProps {
  title: string;
  audioUrl: string;
  showWaveform?: boolean;
}

export default function AudioPlayer({ title, audioUrl, showWaveform = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  const handleSliderChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h3 className="font-medium mb-2 truncate">{title}</h3>
      
      <audio ref={audioRef} src={audioUrl} />
      
      {showWaveform && <WaveformVisualizer audioUrl={audioUrl} />}
      
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button onClick={togglePlayPause} size="icon">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => skip(10)}>
          <SkipForward className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 mx-4">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration}
            step={1}
            onValueChange={handleSliderChange}
          />
        </div>
        
        <span className="text-sm tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

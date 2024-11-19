import { useEffect, useRef, useState } from "react";

interface WaveformVisualizerProps {
  audioUrl: string;
}

export default function WaveformVisualizer({ audioUrl }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioData, setAudioData] = useState<Float32Array | null>(null);

  useEffect(() => {
    const fetchAudioData = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        setAudioData(channelData);
      } catch (error) {
        console.error("Error loading audio data:", error);
      }
    };

    fetchAudioData();
  }, [audioUrl]);

  useEffect(() => {
    if (!audioData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const step = Math.ceil(audioData.length / width);
    
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = "hsl(250, 95%, 60%)";
    ctx.lineWidth = 2;

    for (let i = 0; i < width; i++) {
      const sliceStart = Math.floor(i * step);
      const sliceEnd = Math.floor((i + 1) * step);
      const slice = audioData.slice(sliceStart, sliceEnd);
      const value = Math.max(...slice.map(Math.abs));
      
      const x = i;
      const y = (1 - value) * height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }, [audioData]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={100}
      className="w-full h-[100px] mb-4"
    />
  );
}

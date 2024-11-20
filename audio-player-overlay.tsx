import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  X, 
  Volume2, 
  VolumeX,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const AudioPlayerOverlay = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mock article data
  const article = {
    title: "Understanding Web Accessibility",
    content: "Web accessibility means that websites, tools, and technologies are designed and developed so that people with disabilities can use them...",
    duration: "12:34",
    currentTime: "3:45"
  };

  const skipForward = () => {
    // Implementation for skipping forward 30 seconds
    console.log("Skip forward 30s");
  };

  const skipBackward = () => {
    // Implementation for skipping backward 30 seconds
    console.log("Skip backward 30s");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 bg-white shadow-lg border-t border-gray-200">
      {/* Main Player Bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Title and Controls Section */}
          <div className="flex items-center space-x-4 flex-1">
            {/* Play/Pause Button */}
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              {isPlaying ? 
                <Pause className="w-6 h-6 text-gray-800" /> : 
                <Play className="w-6 h-6 text-gray-800" />
              }
            </button>

            {/* Skip Buttons */}
            <button 
              onClick={skipBackward}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <SkipBack className="w-5 h-5 text-gray-600" />
            </button>
            <button 
              onClick={skipForward}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <SkipForward className="w-5 h-5 text-gray-600" />
            </button>

            {/* Title and Time */}
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-800 truncate">
                {article.title}
              </h3>
              <div className="text-xs text-gray-500">
                {article.currentTime} / {article.duration}
              </div>
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center space-x-4">
            {/* Volume Control */}
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              {isMuted ? 
                <VolumeX className="w-5 h-5 text-gray-600" /> : 
                <Volume2 className="w-5 h-5 text-gray-600" />
              }
            </button>

            {/* Show Notes Toggle */}
            <button 
              onClick={() => setShowNotes(!showNotes)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              {showNotes ? 
                <ChevronDown className="w-5 h-5 text-gray-600" /> : 
                <ChevronUp className="w-5 h-5 text-gray-600" />
              }
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2">
          <div className="h-1 bg-gray-200 rounded-full">
            <div 
              className="h-1 bg-blue-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Show Notes Panel */}
      {showNotes && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 max-h-96 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            <h4 className="text-lg font-semibold mb-2">Show Notes</h4>
            <div className="text-gray-700">
              {article.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayerOverlay;

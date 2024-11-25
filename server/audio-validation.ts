import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface AudioValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    format?: string;
    bitrate?: number;
    sampleRate?: number;
    duration?: number;
    fileSize?: number;
    hasId3Tags?: boolean;
  };
}

interface AudioRequirements {
  maxFileSizeBytes: number;
  minBitrate: number;
  maxBitrate: number;
  allowedSampleRates: number[];
  allowedFormats: string[];
}

const defaultRequirements: AudioRequirements = {
  maxFileSizeBytes: 200 * 1024 * 1024, // 200MB max
  minBitrate: 64,                      // 64 kbps min
  maxBitrate: 320,                     // 320 kbps max
  allowedSampleRates: [44100, 48000],  // Standard sample rates
  allowedFormats: ['mp3', 'm4a']       // Allowed formats
};

export async function validatePodcastAudio(
  filePath: string, 
  requirements: AudioRequirements = defaultRequirements
): Promise<AudioValidationResult> {
  const result: AudioValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    metadata: {}
  };

  try {
    // Check if file exists
    const stats = await fs.stat(filePath);
    result.metadata.fileSize = stats.size;

    // Check file size
    if (stats.size > requirements.maxFileSizeBytes) {
      result.errors.push(`File size ${(stats.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(requirements.maxFileSizeBytes / 1024 / 1024)}MB`);
    }

    // Check file extension
    const fileExt = path.extname(filePath).toLowerCase().replace('.', '');
    if (!requirements.allowedFormats.includes(fileExt)) {
      result.errors.push(`File format ${fileExt} is not supported. Supported formats: ${requirements.allowedFormats.join(', ')}`);
    }

    // Use ffprobe to get detailed audio metadata
    try {
      const ffprobeOutput = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`);
      const metadata = JSON.parse(ffprobeOutput.toString());

      const audioStream = metadata.streams.find((stream: any) => stream.codec_type === 'audio');
      if (!audioStream) {
        result.errors.push('No audio stream found in file');
      } else {
        // Get audio properties
        result.metadata.format = audioStream.codec_name;
        result.metadata.bitrate = parseInt(metadata.format.bit_rate) / 1000;
        result.metadata.sampleRate = parseInt(audioStream.sample_rate);
        result.metadata.duration = parseFloat(metadata.format.duration);

        // Validate bitrate
        if (result.metadata.bitrate < requirements.minBitrate) {
          result.errors.push(`Bitrate ${result.metadata.bitrate}kbps is below minimum ${requirements.minBitrate}kbps`);
        }
        if (result.metadata.bitrate > requirements.maxBitrate) {
          result.errors.push(`Bitrate ${result.metadata.bitrate}kbps exceeds maximum ${requirements.maxBitrate}kbps`);
        }

        // Validate sample rate
        if (!requirements.allowedSampleRates.includes(result.metadata.sampleRate)) {
          result.errors.push(`Sample rate ${result.metadata.sampleRate}Hz is not supported. Supported rates: ${requirements.allowedSampleRates.join(', ')}Hz`);
        }
      }
    } catch (error) {
      result.errors.push('Failed to read audio metadata. Ensure ffmpeg is installed and the file is not corrupted.');
    }

    // Check for ID3 tags if MP3
    if (fileExt === 'mp3') {
      try {
        const id3Output = execSync(`ffprobe -v quiet -print_format json -show_format "${filePath}"`);
        const id3Data = JSON.parse(id3Output.toString());
        result.metadata.hasId3Tags = Object.keys(id3Data.format.tags || {}).length > 0;
        
        if (!result.metadata.hasId3Tags) {
          result.warnings.push('Missing ID3 tags. While not required, tags help with podcast metadata.');
        }
      } catch (error) {
        result.warnings.push('Could not check ID3 tags');
      }
    }

  } catch (error: any) {
    result.errors.push(`Failed to access file: ${error.message}`);
  }

  // Set overall validity
  result.isValid = result.errors.length === 0;

  return result;
}

export async function fixAudioIssues(filePath: string, validation: AudioValidationResult): Promise<string> {
  const outputPath = path.join(
    path.dirname(filePath),
    `fixed_${path.basename(filePath)}`
  );

  try {
    let ffmpegCommand = ['ffmpeg', '-i', filePath];
    let needsConversion = false;

    // Fix bitrate if needed
    if (validation.metadata.bitrate && (validation.metadata.bitrate < 64 || validation.metadata.bitrate > 320)) {
      ffmpegCommand.push('-b:a', '128k');
      needsConversion = true;
    }

    // Fix sample rate if needed
    if (validation.metadata.sampleRate && !defaultRequirements.allowedSampleRates.includes(validation.metadata.sampleRate)) {
      ffmpegCommand.push('-ar', '44100');
      needsConversion = true;
    }

    // Always use MP3 format for consistency
    if (needsConversion) {
      ffmpegCommand.push('-codec:a', 'libmp3lame');
      ffmpegCommand.push(outputPath);

      execSync(ffmpegCommand.join(' '));
      return outputPath;
    }

    return filePath; // Return original path if no fixes needed
  } catch (error: any) {
    throw new Error(`Failed to fix audio issues: ${error.message}`);
  }
}

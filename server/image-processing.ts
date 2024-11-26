import sharp from 'sharp';
import { join } from 'path';
import { randomUUID } from 'crypto';

const DEFAULT_PODCAST_IMAGE_PATH = '/public/images/default-podcast-cover.jpg';

interface ImageConversionResult {
  path: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
  error?: string;
}

export async function convertToPodcastShowImage(
  inputPath: string | Buffer,
  originalFilename?: string
): Promise<ImageConversionResult> {
  const outputFilename = `show-image-${randomUUID()}${originalFilename ? `-${originalFilename}` : ''}.jpg`;
  const outputPath = join(process.cwd(), 'public/images', outputFilename);
  const relativePath = `/public/images/${outputFilename}`;

  try {
    // Process the image
    const image = sharp(inputPath);
    
    // Get original image metadata
    const metadata = await image.metadata();

    // Process the image with podcast platform requirements
    await image
      .rotate() // Auto-correct orientation
      .resize({
        width: 3000,
        height: 3000,
        fit: 'cover',     // Crop to fill
        position: 'center' // Center the image during crop
      })
      .toColorspace('srgb') // Ensure consistent color space
      .jpeg({
        quality: 90,       // High-quality compression
        mozjpeg: true,     // Use mozjpeg for better compression
        progressive: true  // Progressive JPEG for web
      })
      .toFile(outputPath);

    // Get processed image metadata
    const processedMetadata = await sharp(outputPath).metadata();
    
    return {
      path: relativePath,
      metadata: {
        width: processedMetadata.width || 3000,
        height: processedMetadata.height || 3000,
        format: processedMetadata.format || 'jpeg',
        size: processedMetadata.size || 0
      }
    };
  } catch (error) {
    console.error('Image conversion error:', error);
    return {
      path: DEFAULT_PODCAST_IMAGE_PATH,
      metadata: {
        width: 3000,
        height: 3000,
        format: 'jpeg',
        size: 0
      },
      error: error instanceof Error ? error.message : 'Unknown error during image conversion'
    };
  }
}

export async function validatePodcastImage(imagePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(imagePath).metadata();
    
    return !!(
      metadata.width === 3000 &&
      metadata.height === 3000 &&
      ['jpeg', 'png'].includes(metadata.format || '') &&
      (!metadata.size || metadata.size < 2 * 1024 * 1024) // Less than 2MB
    );
  } catch (error) {
    console.error('Image validation error:', error);
    return false;
  }
}

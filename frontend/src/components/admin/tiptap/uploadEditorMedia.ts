import { api } from '../../../api';
import type { Media } from '../../../api';

export type UploadHandler = (file: File) => Promise<Media>;

/**
 * Uploads media file to the authoritative backend pipeline.
 * Uses custom upload handler if provided by caller, otherwise falls back to api.uploadMedia.
 */
export async function uploadMediaFile(
  file: File,
  customUpload?: UploadHandler,
): Promise<Media> {
  if (customUpload) {
    return customUpload(file);
  }
  return api.uploadMedia(file);
}

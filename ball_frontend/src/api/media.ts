import { apiClient } from './client';
import type { PostMedia, MediaType } from './feed';

// ---------------------------------------------------------------------------
// Media upload — the phone uploads raw bytes DIRECTLY to Mux/S3, never through
// Django (CLAUDE.md 36.9). Flow:
//   1. create the Post (feed.createPost)
//   2. requestUploadUrl(postId, type) -> signed URL + media_id
//   3. uploadFileToUrl(url, localUri) -> device streams bytes to Mux/S3
//   4. photo: finalizePhoto(mediaId); video: Mux webhook flips it server-side
// ---------------------------------------------------------------------------

export interface UploadCredential {
  media_id: number;
  provider: 'mux' | 's3';
  upload_url: string;
  // video (Mux)
  upload_id?: string;
  // photo (S3)
  storage_key?: string;
  public_url?: string;
  content_type?: string;
}

export interface RequestUploadParams {
  postId: number;
  mediaType: MediaType;
  contentType?: string; // photos: e.g. 'image/jpeg'
  order?: number;
}

export const requestUploadUrl = async ({
  postId,
  mediaType,
  contentType,
  order = 0,
}: RequestUploadParams): Promise<UploadCredential> => {
  const { data } = await apiClient.post<UploadCredential>('/api/feed/media/upload-url/', {
    post_id: postId,
    media_type: mediaType,
    content_type: contentType,
    order,
  });
  return data;
};

export const finalizePhoto = async (mediaId: number): Promise<PostMedia> => {
  const { data } = await apiClient.post<PostMedia>(`/api/feed/media/${mediaId}/finalize/`, {});
  return data;
};

/**
 * PUT a local file's raw bytes to a presigned Mux/S3 URL, with progress.
 * Reads the file:// URI into a Blob then streams it via XHR (XHR is the only
 * RN networking path that reports upload progress). Resolves on 2xx.
 */
export const uploadFileToUrl = (
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> =>
  new Promise(async (resolve, reject) => {
    try {
      const fileResponse = await fetch(fileUri);
      const blob = await fileResponse.blob();

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.send(blob);
    } catch (err) {
      reject(err as Error);
    }
  });

// Mux HLS playback URL from a playback id (expo-video plays this directly).
export const muxStreamUrl = (playbackId: string) =>
  `https://stream.mux.com/${playbackId}.m3u8`;

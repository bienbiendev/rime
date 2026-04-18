import { FileArchive, FileAudio, FileText, FileVideo } from '@lucide/svelte';
export const mimeTypeToIcon = (type: string) => {
  if (type === 'application/zip') {
    return FileArchive;
  }
  if (type.includes('audio/')) {
    return FileAudio;
  }
  if (type.includes('video/')) {
    return FileVideo;
  }
  return FileText;
};

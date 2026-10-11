import FileArchive from '@lucide/svelte/icons/file-archive';
import FileAudio from '@lucide/svelte/icons/file-audio';
import FileText from '@lucide/svelte/icons/file-text';
import FileVideo from '@lucide/svelte/icons/file-video';
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

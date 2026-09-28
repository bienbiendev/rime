import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptLabel,
  fileSizeBytes,
  fileSizeLabel,
  isAccepted,
  mediaKind,
  mediaMeta,
  typeLabel,
  uploadFiles
} from './upload-file.js';

/** Reads a file as a data url at once. */
class FakeReader {
  result: string | null = null;
  error = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,AAAA`;
    this.onload?.();
  }
}

const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const body = JSON.parse(init.body as string);
  if (body.file.filename === 'broken.jpg') {
    return new Response(JSON.stringify({ message: 'nope' }), { status: 500 });
  }
  return new Response(JSON.stringify({ doc: { id: body.file.filename, url } }));
});

beforeEach(() => {
  vi.stubGlobal('FileReader', FakeReader);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

const jpg = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

describe('uploadFiles', () => {
  it('creates each file without validation, in the given folder', async () => {
    const { docs, failed } = await uploadFiles([jpg('a.jpg'), jpg('b.jpg')], {
      url: '/api/medias',
      path: 'root:press'
    });
    expect(docs.map((doc) => doc.id)).toEqual(['a.jpg', 'b.jpg']);
    expect(failed).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/medias?skipValidation=true');
    expect(JSON.parse(init.body as string)).toEqual({
      _path: 'root:press',
      file: { base64: 'data:image/jpeg;base64,AAAA', filename: 'a.jpg' }
    });
  });

  it('skips a file that fails or is not accepted, and goes on', async () => {
    const pdf = new File(['x'], 'c.pdf', { type: 'application/pdf' });
    const { docs, failed } = await uploadFiles([jpg('broken.jpg'), pdf, jpg('d.jpg')], {
      url: '/api/medias',
      accept: ['image/jpeg']
    });
    expect(docs.map((doc) => doc.id)).toEqual(['d.jpg']);
    expect(failed).toEqual(['broken.jpg', 'c.pdf']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports each step', async () => {
    const steps: unknown[] = [];
    await uploadFiles([jpg('a.jpg'), jpg('broken.jpg')], { url: '/api/medias' }, (progress) =>
      steps.push(progress)
    );
    expect(steps).toEqual([
      { total: 2, uploaded: 0, failed: [], current: 'a.jpg' },
      { total: 2, uploaded: 1, failed: [], current: 'broken.jpg' },
      { total: 2, uploaded: 1, failed: ['broken.jpg'], current: null }
    ]);
  });
});

describe('labels', () => {
  it('reads a mime type', () => {
    expect(typeLabel('image/jpeg')).toBe('JPG');
    expect(typeLabel('application/pdf')).toBe('PDF');
    expect(typeLabel('application/x-unknown')).toBe('X-UNKNOWN');
    expect(typeLabel()).toBe('');
  });

  it('lists the accepted types', () => {
    expect(acceptLabel(['image/jpeg', 'image/png', 'image/webp'], 'or')).toBe('JPG, PNG or WEBP');
    expect(acceptLabel(['image/png'], 'or')).toBe('PNG');
  });

  it('takes anything without accept', () => {
    expect(isAccepted({ type: 'application/pdf' })).toBe(true);
    expect(isAccepted({ type: 'application/pdf' }, ['image/png'])).toBe(false);
  });
});

describe('sizes', () => {
  it('reads a stored size or a count of bytes', () => {
    expect(fileSizeBytes('3.20MB')).toBe(3_200_000);
    expect(fileSizeBytes('0.84KB')).toBe(840);
    expect(fileSizeBytes('12 kb')).toBe(12_000);
    expect(fileSizeBytes(840)).toBe(840);
    expect(fileSizeBytes('')).toBe(null);
    expect(fileSizeBytes('big')).toBe(null);
    expect(fileSizeBytes(undefined)).toBe(null);
  });

  it('writes whole kilobytes, then one decimal from a megabyte up', () => {
    expect(fileSizeLabel(512)).toBe('512 B');
    expect(fileSizeLabel('840.12KB')).toBe('840 KB');
    expect(fileSizeLabel('999.60KB')).toBe('1.0 MB');
    expect(fileSizeLabel('3.20MB')).toBe('3.2 MB');
    expect(fileSizeLabel(1_240_000_000)).toBe('1.2 GB');
    expect(fileSizeLabel(null)).toBe('');
  });

  it('joins the size and the type', () => {
    expect(mediaMeta({ filesize: '3.20MB', mimeType: 'image/jpeg' })).toBe('3.2 MB · JPG');
    expect(mediaMeta({ mimeType: 'application/pdf' })).toBe('PDF');
    expect(mediaMeta({})).toBe('');
  });
});

describe('mediaKind', () => {
  it('sorts a mime type into a kind', () => {
    expect(mediaKind('image/webp')).toBe('image');
    expect(mediaKind('video/mp4')).toBe('video');
    expect(mediaKind('audio/mpeg')).toBe('audio');
    expect(mediaKind('application/pdf')).toBe('document');
    expect(mediaKind('text/csv')).toBe('document');
    expect(
      mediaKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    ).toBe('document');
    expect(mediaKind('application/zip')).toBe('other');
    expect(mediaKind(undefined)).toBe('other');
  });
});

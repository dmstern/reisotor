import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) =>
    host === 'internal.example.com'
      ? [{ address: '10.0.0.5', family: 4 }]
      : [{ address: '93.184.216.34', family: 4 }]
  ),
}));

import {
  downloadRemoteImage,
  localizeImageUrl,
  sniffImageType,
} from '../../src/utils/remoteImage.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);

function imageResponse(body: Buffer, type = 'image/png') {
  return new Response(body, { status: 200, headers: { 'content-type': type } });
}

describe('remoteImage', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('erkennt Bildtypen an Magic Bytes', () => {
    expect(sniffImageType(PNG)?.extension).toBe('png');
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe('jpg');
    expect(sniffImageType(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('lädt ein gültiges Bild', async () => {
    fetchMock.mockResolvedValueOnce(imageResponse(PNG));
    const img = await downloadRemoteImage('https://example.com/a.png');
    expect(img?.mimeType).toBe('image/png');
  });

  it('lehnt private Ziele und DNS-Auflösung auf interne IPs ab', async () => {
    expect(await downloadRemoteImage('http://127.0.0.1/a.png')).toBeNull();
    expect(await downloadRemoteImage('https://internal.example.com/a.png')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prüft Redirect-Ziele erneut', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://192.168.1.1/x.png' } })
    );
    expect(await downloadRemoteImage('https://example.com/a.png')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lehnt falsche Inhalte (Content-Type ok, aber kein Bild) ab', async () => {
    fetchMock.mockResolvedValueOnce(imageResponse(Buffer.from('<html></html>')));
    expect(await downloadRemoteImage('https://example.com/a.png')).toBeNull();
  });

  it('localizeImageUrl lässt lokale URLs und OSM-Kacheln unverändert', async () => {
    expect(await localizeImageUrl('/api/uploads/x.jpg')).toBe('/api/uploads/x.jpg');
    const tile = 'https://tile.openstreetmap.org/15/1/2.png';
    expect(await localizeImageUrl(tile)).toBe(tile);
    expect(await localizeImageUrl(undefined)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('localizeImageUrl behält die URL bei Fehlschlag', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await localizeImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
});

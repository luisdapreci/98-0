import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrandMark } from '../components/brand-mark';

const brandFont = readFile(join(process.cwd(), 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff'));

export function generateImageMetadata() {
  return [180, 192, 512].map((width) => ({
    id: String(width),
    size: { width, height: width },
    contentType: 'image/png',
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const width = Number(await id);
  return new ImageResponse(
    <div style={{
      display: 'flex', width: '100%', height: '100%',
      background: '#131614',
      alignItems: 'center', justifyContent: 'center',
      fontSize: width * 0.42,
    }}>
      <BrandMark />
    </div>,
    {
      width, height: width,
      fonts: [{ name: 'Barlow Condensed', data: await brandFont, weight: 700, style: 'normal' }],
    },
  );
}
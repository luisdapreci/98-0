import { ImageResponse } from 'next/og';

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
      background: '#131614', color: '#d5ef64',
      alignItems: 'center', justifyContent: 'center',
      fontSize: width * 0.3, fontWeight: 700,
      borderBottom: `${width * 0.06}px solid #d5ef64`,
    }}>
      98-0
    </div>,
    { width, height: width },
  );
}
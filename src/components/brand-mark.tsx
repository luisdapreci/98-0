export function BrandMark() {
  return (
    <span aria-hidden="true" style={{
      display: 'flex', position: 'relative', width: '1.8em', height: '1.2em',
      alignItems: 'flex-start', justifyContent: 'center', flexShrink: 0,
      fontFamily: '"Barlow Condensed"', fontWeight: 700, lineHeight: 1,
      letterSpacing: 0, color: '#f3f2eb',
    }}>
      <span>98</span><span style={{ color: '#d5ef64' }}>-</span><span>0</span>
      <span style={{
        position: 'absolute', bottom: '0.06em', left: '0.2em',
        width: '1.12em', height: '0.07em', background: '#d5ef64',
      }} />
      <span style={{
        position: 'absolute', bottom: '0.06em', right: '0.2em',
        width: '0.18em', height: '0.07em', background: '#f3f2eb',
      }} />
    </span>
  );
}
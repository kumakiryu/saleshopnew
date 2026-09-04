import tokenImg from '@/imports/image-6.png';

interface TokenIconProps {
  size?: number;
  className?: string;
}

export default function TokenIcon({ size = 16, className = '' }: TokenIconProps) {
  return (
    <img
      src={tokenImg}
      alt="token"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

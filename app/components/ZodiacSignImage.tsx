import Image from "next/image";

const ZODIAC_IMAGE_MAP: Record<string, string> = {
  Aries:       "/zodiac/optimized/aries.webp",
  Taurus:      "/zodiac/optimized/taurus.webp",
  Gemini:      "/zodiac/optimized/gemini.webp",
  Cancer:      "/zodiac/optimized/cancer.webp",
  Leo:         "/zodiac/optimized/leo.webp",
  Virgo:       "/zodiac/optimized/virgo.webp",
  Libra:       "/zodiac/optimized/libra.webp",
  Scorpio:     "/zodiac/optimized/scorpio.webp",
  Sagittarius: "/zodiac/optimized/sagittarius.webp",
  Capricorn:   "/zodiac/optimized/capricorn.webp",
  Aquarius:    "/zodiac/optimized/aquarius.webp",
  Pisces:      "/zodiac/optimized/pisces.webp",
};

type Props = {
  sign: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function ZodiacSignImage({ sign, size = 48, className, style }: Props) {
  const src = ZODIAC_IMAGE_MAP[sign];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={sign}
      width={size}
      height={size}
      className={className}
      sizes={`${size}px`}
      loading="lazy"
      style={{ borderRadius: "50%", objectFit: "cover", ...style }}
    />
  );
}

export { ZODIAC_IMAGE_MAP };

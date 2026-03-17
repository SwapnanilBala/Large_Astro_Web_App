import Image from "next/image";

const ZODIAC_IMAGE_MAP: Record<string, string> = {
  Aries:       "/zodiac/aries.jpg",
  Taurus:      "/zodiac/taurus.jpg",
  Gemini:      "/zodiac/gemini.jpg",
  Cancer:      "/zodiac/cancer.jpg",
  Leo:         "/zodiac/leo.jpg",
  Virgo:       "/zodiac/virgo.jpg",
  Libra:       "/zodiac/libra.jpg",
  Scorpio:     "/zodiac/scorpio.jpg",
  Sagittarius: "/zodiac/sagittarius.jpg",
  Capricorn:   "/zodiac/capricorn.png",
  Aquarius:    "/zodiac/aquarius.png",
  Pisces:      "/zodiac/pisces.jpg",
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
      style={{ borderRadius: "50%", objectFit: "cover", ...style }}
    />
  );
}

export { ZODIAC_IMAGE_MAP };

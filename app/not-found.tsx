import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found-page">
      {/* Animated stars */}
      <div className="not-found-stars" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="not-found-star"
            style={{
              left: `${(i * 37 + 9) % 100}%`,
              top: `${(i * 47 + 3) % 100}%`,
              animationDelay: `${(i * 0.4) % 5}s`,
              animationDuration: `${1.8 + (i % 5) * 0.6}s`,
            }}
          />
        ))}
      </div>

      {/* Floating planet decoration */}
      <div className="not-found-planet" aria-hidden="true">
        <div className="not-found-planet-body" />
        <div className="not-found-planet-ring" />
      </div>

      <div className="not-found-content">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Lost in the Cosmos</h1>
        <p className="not-found-description">
          The celestial coordinates you seek do not correspond to any known
          destination in our astral map. Perhaps the stars will guide you back.
        </p>

        <div className="not-found-orbit-divider" aria-hidden="true">
          <span className="not-found-orbit-dot" />
          <span className="not-found-orbit-line" />
          <span className="not-found-orbit-dot" />
        </div>

        <Link href="/" className="not-found-home-btn">
          Return to Observatory
        </Link>
      </div>
    </div>
  );
}

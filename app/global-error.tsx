"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #041420 0%, #0f2637 50%, #041420 100%)",
          fontFamily: "'Sora', 'Segoe UI', system-ui, sans-serif",
          color: "#eef7ff",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            padding: "3rem 2rem",
            textAlign: "center",
            borderRadius: "1.25rem",
            background: "rgba(6, 24, 38, 0.72)",
            border: "1px solid rgba(242, 194, 108, 0.2)",
            boxShadow: "0 26px 90px rgba(0, 0, 0, 0.42)",
          }}
        >
          <div
            style={{ fontSize: "2.6rem", marginBottom: "1rem", opacity: 0.7 }}
            aria-hidden="true"
          >
            &#x2728;
          </div>
          <h1
            style={{
              fontSize: "1.32rem",
              fontWeight: 600,
              color: "#f2c26c",
              margin: "0 0 0.75rem",
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
            }}
          >
            Something Went Wrong
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              lineHeight: 1.6,
              color: "#b9d0e1",
              margin: "0 0 2rem",
            }}
          >
            A critical error occurred. Please try refreshing the page.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "rgba(185, 208, 225, 0.5)",
                marginBottom: "1.5rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: "0.625rem",
              border: "1px solid #f2c26c",
              background: "linear-gradient(135deg, #f2c26c, #e0a84b)",
              color: "#102332",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Sora', system-ui, sans-serif",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}

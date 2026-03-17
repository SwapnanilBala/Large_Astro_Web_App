export default function RootLoading() {
  return (
    <div className="root-loader">
      <div className="root-loader-ring" aria-hidden="true">
        <div className="root-loader-orbit">
          <span className="root-loader-planet" />
        </div>
        <div className="root-loader-core" />
      </div>
      <p className="root-loader-text">Aligning the stars&hellip;</p>
    </div>
  );
}

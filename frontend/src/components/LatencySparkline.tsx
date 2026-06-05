type LatencySparklineProps = {
  samples: number[];
};

export function LatencySparkline({ samples }: LatencySparklineProps) {
  const width = 220;
  const height = 54;
  const points = samples.length > 1 ? samples : [0, 0];
  const max = Math.max(240, ...points);
  const path = points
    .map((sample, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - Math.min(1, sample / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Latency sparkline">
      <path d={path} />
      <line x1="0" y1="18" x2={width} y2="18" />
      <line x1="0" y1="36" x2={width} y2="36" />
    </svg>
  );
}


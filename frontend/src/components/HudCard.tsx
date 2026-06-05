type HudCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

export function HudCard({ label, value, detail }: HudCardProps) {
  return (
    <article className="hud-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}


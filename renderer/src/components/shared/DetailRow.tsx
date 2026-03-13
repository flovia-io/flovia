/**
 * DetailRow — Simple label/value row used in expanded details across panels.
 */

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  classPrefix?: string;
}

export default function DetailRow({ label, value, classPrefix = 'gm' }: DetailRowProps) {
  return (
    <div className={`${classPrefix}-detail-row`}>
      <span className={`${classPrefix}-detail-label`}>{label}:</span>
      <span className={`${classPrefix}-detail-value`}>{value}</span>
    </div>
  );
}

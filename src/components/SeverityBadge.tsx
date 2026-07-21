interface SeverityBadgeProps {
  severity: string;
}

const severityStyles: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-blue-50 text-blue-700 border-blue-200",
  Clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
        severityStyles[severity] ?? "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {severity}
    </span>
  );
}

import StudioCard from './StudioCard';

const TIER_COLORS = {
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-500'
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-500'
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-500'
  }
};

export default function TierSection({ title, subtitle, signals, tierColor, onAction }) {
  const colors = TIER_COLORS[tierColor] || TIER_COLORS.yellow;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`text-xl font-bold ${colors.text}`}>{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <span className={`${colors.badge} text-white px-3 py-1 rounded-full text-sm font-medium`}>
          {signals.length}
        </span>
      </div>

      {/* Cards */}
      {signals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No opportunities in this tier right now
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map(signal => (
            <StudioCard
              key={signal.id}
              signal={signal}
              tierColor={tierColor}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

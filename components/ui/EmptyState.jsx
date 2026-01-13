export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="text-center py-12">
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}




'use client';

export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 border-b mb-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-4 py-3 font-medium text-sm transition-all border-b-2 -mb-px
            ${activeTab === tab.id 
              ? 'text-blue-600 border-blue-600' 
              : 'text-gray-500 border-transparent hover:text-gray-700'
            }
          `}
        >
          <span className="flex items-center gap-2">
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs
                ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
              `}>
                {tab.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}




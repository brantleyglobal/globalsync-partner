import React from 'react';

export default function DashboardCard({ title, subtitle, metric, status, onClick, className = "" }) {
  return (
    <div 
      onClick={onClick}
      className={`group p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-slate-200 font-medium tracking-wide text-sm uppercase">{title}</h3>
          <span className="text-slate-500 group-hover:text-indigo-400 transition-colors text-lg">→</span>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">{subtitle}</p>
      </div>
      
      <div className="flex justify-between items-end mt-4">
        {/* Monospace font is critical for keeping financial numbers perfectly aligned */}
        <span className="text-2xl font-semibold text-white font-mono tracking-tight">{metric}</span>
        {status && (
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium font-mono ${status.bg} ${status.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot} mr-1.5`} />
            {status.label}
          </span>
        )}
      </div>
    </div>
  );
}
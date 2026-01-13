import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import { ProcessedRow } from '../types';

interface ForecastChartProps {
  history: ProcessedRow[];
  forecast: ProcessedRow[];
}

const ForecastChart: React.FC<ForecastChartProps> = ({ history, forecast }) => {
  // Combine data for display
  const combinedData = [
    ...history.map(r => ({ ...r, type: 'Historical', gm_p10: null, gm_p90: null, gm_v3: null })),
    ...forecast.map(r => ({ ...r, type: 'Forecast', gm_real: null }))
  ];

  return (
    <div className="h-[500px] w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Gm Tariff Forecast (2026-2037)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="mes_ano" 
            tick={{fontSize: 12}} 
            interval={12} // Show every year approx
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis label={{ value: 'COP / kWh', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
          />
          <Legend verticalAlign="top" height={36}/>
          
          {/* Historical */}
          <Line type="monotone" dataKey="gm_real" name="Historical Gm" stroke="#334155" strokeWidth={2} dot={false} />
          
          {/* Models */}
          <Line type="monotone" dataKey="gm_federico" name="User Forecast" stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="gm_v3" name="V3 (Recommended)" stroke="#2563eb" strokeWidth={3} dot={false} />
          
          {/* Confidence Intervals - Using simple lines for visualization as Area needs stacked data which is complex with nulls here */}
          <Line type="monotone" dataKey="gm_p90" name="P90" stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="gm_p10" name="P10" stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1} dot={false} />

        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ForecastChart;
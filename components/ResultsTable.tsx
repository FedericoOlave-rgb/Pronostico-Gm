import React from 'react';
import { ProcessedRow } from '../types';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

interface ResultsTableProps {
  data: ProcessedRow[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.map(r => ({
      Fecha: r.mes_ano,
      'Gm V3 (P50)': r.gm_v3?.toFixed(2),
      'Gm P10': r.gm_p10?.toFixed(2),
      'Gm P90': r.gm_p90?.toFixed(2),
      'Gm User': r.gm_federico?.toFixed(2),
      'ENSO Phase': r.fase_enso_simple
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Forecast V3");
    XLSX.writeFile(wb, "Gm_Forecast_V3.xlsx");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800">Forecast Data</h3>
        <button 
          onClick={downloadExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={16} /> Export Excel
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">P50 (V3)</th>
              <th className="px-6 py-3">P10</th>
              <th className="px-6 py-3">P90</th>
              <th className="px-6 py-3">User Model</th>
              <th className="px-6 py-3">Phase</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="bg-white border-b hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{row.mes_ano}</td>
                <td className="px-6 py-3 text-blue-600 font-bold">{row.gm_v3?.toFixed(2)}</td>
                <td className="px-6 py-3 text-green-600">{row.gm_p10?.toFixed(2)}</td>
                <td className="px-6 py-3 text-red-600">{row.gm_p90?.toFixed(2)}</td>
                <td className="px-6 py-3 text-slate-500">{row.gm_federico?.toFixed(2)}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    row.fase_enso_simple === 'La Niña' ? 'bg-blue-100 text-blue-800' :
                    row.fase_enso_simple === 'El Niño' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {row.fase_enso_simple}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
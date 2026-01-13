import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ForecastChart from './components/ForecastChart';
import ResultsTable from './components/ResultsTable';
import { processFiles } from './services/processor';
import { SimulationResult, FileType } from './types';
import { Activity, BarChart3, Calculator, AlertCircle } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<Record<FileType, File | null>>({
    [FileType.HISTORICAL_REGIONAL]: null,
    [FileType.HISTORICAL_EXOG]: null,
    [FileType.PROJECTION_EXOG]: null,
    [FileType.FORECAST_PREV]: null
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (type: FileType) => (file: File) => {
    setFiles(prev => ({ ...prev, [type]: file }));
    setError(null);
  };

  const handleRunForecast = async () => {
    if (!Object.values(files).every(f => f !== null)) {
      setError("Please upload all 4 required files.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await processFiles(
        files[FileType.HISTORICAL_REGIONAL]!,
        files[FileType.HISTORICAL_EXOG]!,
        files[FileType.PROJECTION_EXOG]!,
        files[FileType.FORECAST_PREV]!
      );
      setResult(res);
    } catch (e: any) {
      console.error(e);
      setError("Error processing files. Please check file formats and structure. " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Activity size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gconomic Gm Forecaster</h1>
          </div>
          <div className="text-sm text-slate-500">v2.0 (Ridge + Consensus)</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Input Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            Data Input
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FileUpload 
              label="1. Historical Regional Gm" 
              accept=".xlsx,.xls,.csv" 
              selectedFile={files[FileType.HISTORICAL_REGIONAL]}
              onFileSelect={handleFileSelect(FileType.HISTORICAL_REGIONAL)}
            />
            <FileUpload 
              label="2. Historical Exogenous" 
              accept=".xlsx,.xls,.csv"
              selectedFile={files[FileType.HISTORICAL_EXOG]}
              onFileSelect={handleFileSelect(FileType.HISTORICAL_EXOG)}
            />
            <FileUpload 
              label="3. Projected Exogenous" 
              accept=".xlsx,.xls,.csv"
              selectedFile={files[FileType.PROJECTION_EXOG]}
              onFileSelect={handleFileSelect(FileType.PROJECTION_EXOG)}
            />
            <FileUpload 
              label="4. Previous Forecast" 
              accept=".xlsx,.xls,.csv"
              selectedFile={files[FileType.FORECAST_PREV]}
              onFileSelect={handleFileSelect(FileType.FORECAST_PREV)}
            />
          </div>
          
          <div className="mt-6 flex items-center justify-end gap-4">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <button
              onClick={handleRunForecast}
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all ${
                loading 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-200'
              }`}
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <Calculator size={18} /> Run Forecast
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Section */}
        {result && (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard title="User Model Mean" value={result.metrics.federico_mean} />
              <MetricCard title="ML Model (V2) Mean" value={result.metrics.v2_mean} />
              <MetricCard title="Consensus Mean" value={result.metrics.consenso_mean} />
              <MetricCard 
                title="V3 Final Mean" 
                value={result.metrics.v3_mean} 
                highlight 
                diff={result.metrics.diff_v3_federico_percent}
              />
            </div>

            {/* Charts */}
            <ForecastChart history={result.history} forecast={result.forecast} />

            {/* Table */}
            <ResultsTable data={result.forecast} />
          </>
        )}
      </main>
    </div>
  );
}

const MetricCard = ({ title, value, highlight, diff }: { title: string, value: number, highlight?: boolean, diff?: number }) => (
  <div className={`p-4 rounded-xl border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'} shadow-sm`}>
    <p className="text-sm text-slate-500 mb-1">{title}</p>
    <div className="flex items-baseline gap-2">
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-700' : 'text-slate-900'}`}>
        {value.toFixed(1)} <span className="text-sm font-normal text-slate-400">COP/kWh</span>
      </p>
    </div>
    {diff !== undefined && (
      <p className={`text-xs mt-2 font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs User
      </p>
    )}
  </div>
);
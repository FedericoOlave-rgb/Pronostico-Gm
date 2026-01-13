import * as XLSX from 'xlsx';
import { HistoricalRow, ExogenousRow, ForecastRow, ProcessedRow, SimulationResult } from '../types';
import { RidgeRegression, StandardScaler, normInv } from '../utils/mathUtils';

// --- Helpers ---

const parseDate = (val: any): Date | null => {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  if (typeof val === 'string') {
    // Try standard parsing
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const formatMonthYear = (date: Date): string => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${m.toString().padStart(2, '0')}`;
};

const getMonthYearFromStr = (str: string): string => {
    // Expected YYYY-MM
    return str.trim();
}

// --- Data Preparation ---

export const processFiles = async (
  fileRegional: File,
  fileExogHist: File,
  fileExogProj: File,
  fileForecastPrev: File
): Promise<SimulationResult> => {
  
  // 1. Load Data
  const regionalData = await readExcel<HistoricalRow>(fileRegional, "Historical Regional");
  const exogHistData = await readExcel<ExogenousRow>(fileExogHist, "Historical Exogenous");
  const exogProjData = await readExcel<ExogenousRow>(fileExogProj, "Projected Exogenous");
  const forecastPrevData = await readExcel<ForecastRow>(fileForecastPrev, "Previous Forecast");

  // 2. Prepare Historical Dataset
  // Merge regional Gm with Exogenous Hist by Date
  // Filter < 2025-11-01
  const cutoffDate = new Date('2025-11-01');
  
  const historicalRows: ProcessedRow[] = [];

  // Create map for fast lookup of exogenous data
  const exogMap = new Map<string, ExogenousRow>();
  exogHistData.forEach(row => {
    const d = parseDate(row.Fecha);
    if (d) {
        exogMap.set(formatMonthYear(d), row);
    }
  });

  regionalData.forEach(regRow => {
    const d = parseDate(regRow.Fecha);
    if (!d) return;

    if (d >= cutoffDate) return;

    const key = formatMonthYear(d);
    const exog = exogMap.get(key);

    if (exog && regRow.Gm_Promedio !== undefined) {
      historicalRows.push(transformRow(d, regRow.Gm_Promedio, exog));
    }
  });

  if (historicalRows.length === 0) {
      throw new Error("No overlapping historical data found. Please check that 'Fecha' columns exist, contain valid dates, and overlap between the Regional and Exogenous files.");
  }

  // 3. Train Models
  // Features: ['Precio_$/m3', 'IPC Índice', 'TRM', 'Deficit_%', 'Hidráulica (%)', 'Termica_x_Gas']
  const featureKeys = ['precio_gas', 'ipc', 'trm', 'deficit', 'hidraulica', 'termica_x_gas'] as const;
  
  const X_all = historicalRows.map(r => featureKeys.map(k => r[k]));
  const y_all = historicalRows.map(r => r.gm_real!);

  // Phase specific data
  const phases = ['La Niña', 'El Niño', 'Neutral'] as const;
  const models: Record<string, { model: RidgeRegression, scaler: StandardScaler }> = {};

  // Train Phase Models (Capa 1)
  phases.forEach(phase => {
    const indices = historicalRows.map((r, i) => r.fase_enso_simple === phase ? i : -1).filter(i => i !== -1);
    if (indices.length > 10) {
      const X_phase = indices.map(i => X_all[i]);
      const y_phase = indices.map(i => y_all[i]);
      
      const scaler = new StandardScaler();
      scaler.fit(X_phase);
      const X_scaled = scaler.transform(X_phase);
      
      const model = new RidgeRegression(5.0);
      model.fit(X_scaled, y_phase);
      
      models[phase] = { model, scaler };
    }
  });

  // Train General Model (Capa 2)
  const scalerGeneral = new StandardScaler();
  scalerGeneral.fit(X_all);
  const X_all_scaled = scalerGeneral.transform(X_all);
  const modelGeneral = new RidgeRegression(3.0);
  modelGeneral.fit(X_all_scaled, y_all);

  // 4. Generate V2 Forecast
  // Prepare Projection Data
  const projectionRows: ProcessedRow[] = [];
  
  // Previous forecast map
  const prevForecastMap = new Map<string, number>();
  forecastPrevData.forEach(r => {
      // Clean up date string if needed, expecting YYYY-MM
      // Some excel files might parse as date objects even if column says Mes_Año
      let key = "";
      const val = r.Mes_Año as any;
      if(val instanceof Date) {
          key = formatMonthYear(val);
      } else {
          key = String(val);
      }
      // Ensure we only look at >= 2026-01-01
      if(key >= '2026-01') {
        prevForecastMap.set(key, r.Gm_Promedio);
      }
  });

  exogProjData.forEach(row => {
    // Projections typically have string Mes_Año or Date
    let d: Date | null;
    if ((row as any).Mes_Año) { // Check if specific column exists from different format
        // Handle if projections use Mes_Año instead of Fecha
         d = new Date((row as any).Mes_Año + "-01");
    } else {
         d = parseDate(row.Fecha);
    }
    
    if (!d || isNaN(d.getTime())) return;
    
    // Filter >= 2026-01-01
    if (d < new Date('2026-01-01')) return;

    // Transform row (dummy Gm=0)
    const procRow = transformRow(d, 0, row);
    
    // User forecast
    const key = formatMonthYear(d);
    procRow.gm_federico = prevForecastMap.get(key) || 0;

    // V2 Prediction
    const X_input = [featureKeys.map(k => procRow[k])];
    
    // Phase prediction
    let pred_fase = 0;
    const phase = procRow.fase_enso_simple;
    if (models[phase]) {
      const X_scaled = models[phase].scaler.transform(X_input);
      if (X_scaled && X_scaled.length > 0) {
          const preds = models[phase].model.predict(X_scaled);
          if (preds && preds.length > 0) {
              pred_fase = preds[0];
          }
      }
    } else {
      // Fallback to general if phase model not available
      const X_scaled_gen = scalerGeneral.transform(X_input);
      if (X_scaled_gen && X_scaled_gen.length > 0) {
          const preds = modelGeneral.predict(X_scaled_gen);
          if (preds && preds.length > 0) {
             pred_fase = preds[0];
          }
      }
    }

    // General prediction
    const X_scaled_gen = scalerGeneral.transform(X_input);
    let pred_general = 0;
    if (X_scaled_gen && X_scaled_gen.length > 0) {
        const preds = modelGeneral.predict(X_scaled_gen);
        if (preds && preds.length > 0) {
            pred_general = preds[0];
        }
    }

    // Ensemble
    let forecast = 0.70 * pred_fase + 0.30 * pred_general;
    
    // Clip
    forecast = Math.max(180, Math.min(900, forecast));
    procRow.gm_v2 = forecast;

    projectionRows.push(procRow);
  });
  
  if (projectionRows.length === 0) {
      throw new Error("No projection data generated. Ensure 'Projected Exogenous' file has dates starting from Jan 2026.");
  }

  // 5. Consensus & Smoothing
  // Calculate Consenso Base
  projectionRows.forEach(r => {
    r.gm_consenso = (r.gm_federico! * 0.50) + (r.gm_v2! * 0.50);
  });

  // Smoothing 2027-2030
  const indicesSmooth: number[] = [];
  projectionRows.forEach((r, i) => {
    const y = r.date.getFullYear();
    if (y >= 2027 && y <= 2030) indicesSmooth.push(i);
  });

  if (indicesSmooth.length > 0) {
    const sumSmooth = indicesSmooth.reduce((sum, idx) => sum + projectionRows[idx].gm_consenso!, 0);
    const avgSmooth = sumSmooth / indicesSmooth.length;
    
    indicesSmooth.forEach(idx => {
      const val = projectionRows[idx].gm_consenso!;
      const deviation = val - avgSmooth;
      projectionRows[idx].gm_consenso = avgSmooth + (deviation * 0.85);
    });
  }

  // Moving Average 3
  const consensoSmoothed = movingAverage3(projectionRows.map(r => r.gm_consenso!));
  projectionRows.forEach((r, i) => {
    r.gm_consenso = consensoSmoothed[i];
  });

  // 6. V3 Calculation
  projectionRows.forEach(r => {
    r.gm_v3 = (r.gm_consenso! * 0.70) + (r.gm_federico! * 0.30);
  });

  const v3Smoothed = movingAverage3(projectionRows.map(r => r.gm_v3!));
  projectionRows.forEach((r, i) => {
    r.gm_v3 = v3Smoothed[i];
  });

  // 7. Confidence Intervals
  const histMean = y_all.reduce((a,b)=>a+b,0)/y_all.length;
  const histStd = Math.sqrt(y_all.reduce((a,b)=>a + Math.pow(b-histMean, 2), 0)/y_all.length);
  const volatilityHist = histStd / histMean;

  const z_p10 = normInv(0.10);
  const z_p90 = normInv(0.90);

  projectionRows.forEach((r, i) => {
    const diff = Math.abs(r.gm_federico! - r.gm_consenso!);
    const uncertainty = diff / (r.gm_v3! || 1); // Avoid division by zero
    
    let volBase = r.gm_v3! * (volatilityHist * 0.35 + uncertainty * 0.65) * 0.85;
    
    const monthsHorizon = i + 1;
    const timeFactor = Math.sqrt(monthsHorizon / 12);
    
    const volFinal = volBase * timeFactor;
    
    r.gm_p10 = Math.max(150, r.gm_v3! + z_p10 * volFinal);
    r.gm_p90 = Math.min(1500, r.gm_v3! + z_p90 * volFinal);
  });

  // Calculate Metrics
  const meanV2 = projectionRows.reduce((s, r) => s + r.gm_v2!, 0) / projectionRows.length;
  const meanFed = projectionRows.reduce((s, r) => s + r.gm_federico!, 0) / projectionRows.length;
  const meanCon = projectionRows.reduce((s, r) => s + r.gm_consenso!, 0) / projectionRows.length;
  const meanV3 = projectionRows.reduce((s, r) => s + r.gm_v3!, 0) / projectionRows.length;
  
  return {
    history: historicalRows,
    forecast: projectionRows,
    metrics: {
      v2_mean: meanV2,
      federico_mean: meanFed,
      consenso_mean: meanCon,
      v3_mean: meanV3,
      diff_v3_federico_percent: ((meanV3 - meanFed) / meanFed) * 100
    }
  };
};

// --- Utils ---

function readExcel<T>(file: File, label: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error(`File '${label}' has no sheets.`));
            return;
        }
        
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        
        if (!firstSheet) {
             reject(new Error(`File '${label}' sheet '${firstSheetName}' is empty or invalid.`));
             return;
        }

        const jsonData = XLSX.utils.sheet_to_json<T>(firstSheet);
        resolve(jsonData);
      } catch (err) {
        reject(new Error(`Failed to parse '${label}': ${(err as any).message}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read file '${label}'`));
    reader.readAsArrayBuffer(file);
  });
}

function transformRow(date: Date, gm: number, exog: ExogenousRow): ProcessedRow {
  // Parsing helpers
  const parsePercent = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace('%', ''));
    return 0;
  };

  const embalses = parsePercent(exog['Embalses SIN %']);
  const termica = exog['Térmica (%)'] || 0;
  const precioGas = exog['Precio_$/m3'] || 0;
  
  // Phase logic
  let fase: 'La Niña' | 'El Niño' | 'Neutral' = 'Neutral';
  const faseRaw = (exog['Fase ENSO'] || '').toString();
  if (faseRaw.toLowerCase().includes('niña')) fase = 'La Niña';
  else if (faseRaw.toLowerCase().includes('niño') && !faseRaw.toLowerCase().includes('niña')) fase = 'El Niño';

  return {
    date: date,
    mes_ano: formatMonthYear(date),
    gm_real: gm,
    precio_gas: precioGas,
    ipc: exog['IPC Índice'] || 0,
    trm: exog.TRM || 0,
    deficit: exog['Deficit_%'] || 0,
    hidraulica: exog['Hidráulica (%)'] || 0,
    termica_x_gas: termica * precioGas,
    fase_enso_simple: fase,
  };
}

function movingAverage3(data: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - 1);
    const end = Math.min(data.length - 1, i + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j];
      count++;
    }
    result.push(sum / count);
  }
  return result;
}
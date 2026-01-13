export interface HistoricalRow {
  Fecha: any;
  Gm_Promedio: number;
  [key: string]: any;
}

export interface ExogenousRow {
  Fecha: any;
  'Precio_$/m3': number;
  'IPC Índice': number;
  TRM: number;
  'Deficit_%': number;
  'Hidráulica (%)': number;
  'Térmica (%)': number;
  'Embalses SIN %': string | number;
  'Fase ENSO': string;
  [key: string]: any;
}

export interface ForecastRow {
  Mes_Año: string;
  Gm_Promedio: number; // The user's previous forecast
  [key: string]: any;
}

export interface ProcessedRow {
  date: Date;
  mes_ano: string;
  // Features
  precio_gas: number;
  ipc: number;
  trm: number;
  deficit: number;
  hidraulica: number;
  termica_x_gas: number;
  fase_enso_simple: 'La Niña' | 'El Niño' | 'Neutral';
  // Targets/Results
  gm_real?: number;
  gm_federico?: number;
  gm_v2?: number;
  gm_consenso?: number;
  gm_v3?: number;
  gm_p10?: number;
  gm_p90?: number;
}

export interface SimulationResult {
  history: ProcessedRow[];
  forecast: ProcessedRow[];
  metrics: {
    v2_mean: number;
    federico_mean: number;
    consenso_mean: number;
    v3_mean: number;
    diff_v3_federico_percent: number;
  };
}

export enum FileType {
  HISTORICAL_REGIONAL = 'HISTORICAL_REGIONAL',
  HISTORICAL_EXOG = 'HISTORICAL_EXOG',
  PROJECTION_EXOG = 'PROJECTION_EXOG',
  FORECAST_PREV = 'FORECAST_PREV'
}
import { inv, multiply, transpose, identity, add, matrix, Matrix, mean, std } from 'mathjs';

// Standard Scaler to normalize data (mean=0, variance=1)
export class StandardScaler {
  mean: number[] = [];
  scale: number[] = [];

  fit(X: number[][]): void {
    if (!X || X.length === 0 || !X[0]) return;

    const nSamples = X.length;
    const nFeatures = X[0].length;
    this.mean = new Array(nFeatures).fill(0);
    this.scale = new Array(nFeatures).fill(0);

    // Calculate mean
    for (let j = 0; j < nFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < nSamples; i++) {
        // Safe access
        const val = X[i][j];
        if (typeof val === 'number') sum += val;
      }
      this.mean[j] = sum / nSamples;
    }

    // Calculate std dev
    for (let j = 0; j < nFeatures; j++) {
      let sumSq = 0;
      for (let i = 0; i < nSamples; i++) {
        const val = X[i][j];
        if (typeof val === 'number') {
            sumSq += Math.pow(val - this.mean[j], 2);
        }
      }
      this.scale[j] = Math.sqrt(sumSq / nSamples) || 1; // Avoid divide by zero
    }
  }

  transform(X: number[][]): number[][] {
    if (!X || X.length === 0) return [];
    // If fit wasn't called or failed (empty data), return X as is
    if (this.mean.length === 0) return X;

    return X.map(row => {
        if (!row) return []; 
        return row.map((val, j) => {
            const m = this.mean[j] || 0;
            const s = this.scale[j] || 1;
            return (val - m) / s;
        });
    });
  }
}

// Ridge Regression using Normal Equation: beta = (X'X + alpha*I)^-1 * X'y
export class RidgeRegression {
  private coefficients: number[] = [];
  private intercept: number = 0;
  private alpha: number;

  constructor(alpha: number = 1.0) {
    this.alpha = alpha;
  }

  fit(X: number[][], y: number[]): void {
    // Robust check for X and y
    if (!X || X.length === 0 || !X[0]) return;
    if (!y || y.length === 0) return;
    
    // Add intercept column (bias) is usually handled by centering y in Ridge, 
    // or by adding a column of 1s and not penalizing it. 
    // Scikit-learn Ridge centers X and y by default. We will assume X is already scaled.
    // We will center y here to calculate intercept separately.
    
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const yCentered = y.map(val => val - yMean);

    const nFeatures = X[0].length;
    
    // Convert to mathjs matrices
    const X_mat = matrix(X);
    const y_mat = matrix(yCentered); // Column vector implicitly

    // XT
    const XT = transpose(X_mat);
    
    // XT * X
    const XTX = multiply(XT, X_mat);
    
    // alpha * I
    const I = identity(nFeatures);
    const alphaI = multiply(I, this.alpha);
    
    // (XTX + alphaI)
    const A = add(XTX, alphaI);
    
    // Inverse
    const A_inv = inv(A);
    
    // XT * y
    const XTy = multiply(XT, y_mat);
    
    // beta = A_inv * XTy
    const beta = multiply(A_inv, XTy);
    
    // mathjs might return a matrix or array depending on operations
    this.coefficients = (beta as any).valueOf().flat();
    
    // Intercept is yMean (since X is standardized to mean 0)
    // If X wasn't standardized, we'd need: yMean - sum(coef * xMean)
    // But our StandardScaler ensures X mean is 0.
    this.intercept = yMean;
  }

  predict(X: number[][]): number[] {
    if (!X || X.length === 0) return [];
    return X.map(row => {
      if (!row) return this.intercept;
      let sum = this.intercept;
      for (let i = 0; i < row.length; i++) {
        const coef = this.coefficients[i] || 0; // Guard against mismatch
        sum += row[i] * coef;
      }
      return sum;
    });
  }
}

// Inverse Normal Cumulative Distribution Function (Probit)
// Approximate implementation for P10/P90
export function normInv(p: number): number {
  // Coefficients in rational approximation
  const a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969;
  const a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
  const b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887;
  const b4 = 66.8013118877197, b5 = -13.2806815528857, c1 = -7.78489400243029e-03;
  const c2 = -0.322396458041136, c3 = -2.40075827716184, c4 = -2.54973253934373;
  const c5 = 4.37466414146497, c6 = 2.93816398269878, d1 = 7.78469570904146e-03;
  const d2 = 0.32246712907004, d3 = 2.445134137143, d4 = 3.75440866190742;
  const p_low = 0.02425, p_high = 1 - p_low;

  let q: number, r: number;
  if (p < p_low) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= p_high) {
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}
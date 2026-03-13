/**
 * Correlation calculation utilities
 * - Pearson correlation coefficient
 * - Rolling correlation
 */

/**
 * Calculate Pearson correlation coefficient between two arrays
 * Returns value between -1 and 1
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;

  return numerator / denom;
}

/**
 * Calculate correlation matrix for multiple assets
 * Returns NxN matrix where matrix[i][j] = correlation(assets[i], assets[j])
 */
export function correlationMatrix(
  returnsSeries: number[][]
): number[][] {
  const n = returnsSeries.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0)
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const corr = pearsonCorrelation(returnsSeries[i], returnsSeries[j]);
        matrix[i][j] = corr;
        matrix[j][i] = corr;
      }
    }
  }

  return matrix;
}

/**
 * Calculate rolling correlation between two series
 */
export function rollingCorrelation(
  x: number[],
  y: number[],
  times: string[],
  window: number
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  const n = Math.min(x.length, y.length, times.length);

  for (let i = window; i <= n; i++) {
    const xSlice = x.slice(i - window, i);
    const ySlice = y.slice(i - window, i);
    result.push({
      time: times[i - 1],
      value: pearsonCorrelation(xSlice, ySlice),
    });
  }

  return result;
}

/**
 * Calculate daily returns from price series
 */
export function pricesToReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] === 0) {
      returns.push(0);
    } else {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

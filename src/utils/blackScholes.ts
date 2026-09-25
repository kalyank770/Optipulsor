/**
 * Black-Scholes Options Pricing & Greeks Calculator
 */

// Standard normal cumulative distribution function (Abramowitz and Stegun approximation)
export function standardNormalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * erf);
}

// Standard normal probability density function
export function standardNormalPDF(x: number): number {
  return (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // Daily theta decay
  vega: number;  // 1% vol change sensitivity
}

/**
 * Computes European Call & Put price and Greeks
 * @param S Current Spot Price
 * @param K Strike Price
 * @param T Time to expiration in years (e.g. 7 days / 365)
 * @param r Risk-free interest rate (e.g. 0.065 for India or 0.045 for US)
 * @param sigma Implied Volatility as a decimal (e.g. 0.15 for 15%)
 * @param type 'CE' | 'PE'
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: 'CE' | 'PE'
): BSResult {
  // Prevent division by zero or negative time
  const timeToExpiry = Math.max(T, 0.0001);
  const vol = Math.max(sigma, 0.01);
  const sqrtT = Math.sqrt(timeToExpiry);

  const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * timeToExpiry) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;

  const nd1 = standardNormalCDF(d1);
  const nd2 = standardNormalCDF(d2);
  const n_neg_d1 = standardNormalCDF(-d1);
  const n_neg_d2 = standardNormalCDF(-d2);
  const pdf_d1 = standardNormalPDF(d1);

  const discount = Math.exp(-r * timeToExpiry);

  let price = 0;
  let delta = 0;

  if (type === 'CE') {
    price = S * nd1 - K * discount * nd2;
    delta = nd1;
  } else {
    price = K * discount * n_neg_d2 - S * n_neg_d1;
    delta = nd1 - 1.0;
  }

  // Gamma is identical for Call and Put
  const gamma = pdf_d1 / (S * vol * sqrtT);

  // Vega per 1% change in volatility
  const vega = (S * sqrtT * pdf_d1) / 100;

  // Theta (converted to 1 calendar day decay)
  let theta = 0;
  if (type === 'CE') {
    const term1 = -(S * pdf_d1 * vol) / (2 * sqrtT);
    const term2 = -r * K * discount * nd2;
    theta = (term1 + term2) / 365;
  } else {
    const term1 = -(S * pdf_d1 * vol) / (2 * sqrtT);
    const term2 = r * K * discount * n_neg_d2;
    theta = (term1 + term2) / 365;
  }

  return {
    price: Math.max(price, 0.05),
    delta: Number(delta.toFixed(4)),
    gamma: Number(gamma.toFixed(6)),
    theta: Number(theta.toFixed(2)),
    vega: Number(vega.toFixed(3)),
  };
}

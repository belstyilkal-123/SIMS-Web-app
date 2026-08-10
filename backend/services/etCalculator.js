// Mock constants for Crop Coefficients (Kc)
const CROP_COEFFICIENTS = {
  'maize': { initial: 0.3, crop_dev: 0.8, mid_season: 1.2, late_season: 0.6 },
  'wheat': { initial: 0.3, crop_dev: 0.7, mid_season: 1.15, late_season: 0.4 },
  'teff': { initial: 0.3, crop_dev: 0.6, mid_season: 1.0, late_season: 0.3 },
  'default': { initial: 0.4, crop_dev: 0.8, mid_season: 1.0, late_season: 0.5 }
};

class ETCalculator {
  /**
   * Calculates Reference Evapotranspiration (ET0) using Hargreaves simplified method
   * @param {number} tMean Mean temperature (°C)
   * @param {number} tMax Max temperature (°C)
   * @param {number} tMin Min temperature (°C)
   * @param {number} extraterrestrialRadiation (Ra) in mm/day (mocked based on latitude usually)
   * @returns {number} ET0 in mm/day
   */
  calculateET0(tMean, tMax, tMin, ra = 15) {
    // Hargreaves equation: ET0 = 0.0023 * Ra * (tMean + 17.8) * sqrt(tMax - tMin)
    if (tMax <= tMin) return 0; // Invalid input fallback
    
    const et0 = 0.0023 * ra * (tMean + 17.8) * Math.sqrt(tMax - tMin);
    return Math.max(0, parseFloat(et0.toFixed(2))); // Prevent negative ET
  }

  /**
   * Calculate Crop Evapotranspiration (ETc)
   * @param {number} et0 Reference ET
   * @param {string} cropType Name of crop
   * @param {string} growthStage 'initial', 'crop_dev', 'mid_season', 'late_season'
   * @returns {number} ETc in mm/day
   */
  calculateETc(et0, cropType, growthStage) {
    const normalizedCrop = cropType ? cropType.toLowerCase() : 'default';
    const kcTable = CROP_COEFFICIENTS[normalizedCrop] || CROP_COEFFICIENTS['default'];
    const kc = kcTable[growthStage] || kcTable['mid_season'];
    
    return parseFloat((et0 * kc).toFixed(2));
  }
}

module.exports = new ETCalculator();

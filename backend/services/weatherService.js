/**
 * WeatherService — Real weather data using Open-Meteo API
 *
 * Open-Meteo is completely free, requires NO API key, and covers Ethiopia.
 * Docs: https://open-meteo.com/en/docs
 *
 * Fallback: if the network request fails, returns a clearly-labeled
 * "unavailable" response — never returns fake random data.
 */

const axios = require('axios');

// WMO Weather interpretation codes → human-readable label + emoji
const WMO_CODES = {
  0:  { label: 'Clear Sky',          emoji: '☀️' },
  1:  { label: 'Mainly Clear',       emoji: '🌤️' },
  2:  { label: 'Partly Cloudy',      emoji: '⛅' },
  3:  { label: 'Overcast',           emoji: '☁️' },
  45: { label: 'Foggy',              emoji: '🌫️' },
  48: { label: 'Icy Fog',            emoji: '🌫️' },
  51: { label: 'Light Drizzle',      emoji: '🌦️' },
  53: { label: 'Drizzle',            emoji: '🌦️' },
  55: { label: 'Heavy Drizzle',      emoji: '🌧️' },
  61: { label: 'Light Rain',         emoji: '🌧️' },
  63: { label: 'Rain',               emoji: '🌧️' },
  65: { label: 'Heavy Rain',         emoji: '🌧️' },
  71: { label: 'Light Snow',         emoji: '🌨️' },
  73: { label: 'Snow',               emoji: '🌨️' },
  75: { label: 'Heavy Snow',         emoji: '❄️' },
  80: { label: 'Light Showers',      emoji: '🌦️' },
  81: { label: 'Showers',            emoji: '🌧️' },
  82: { label: 'Heavy Showers',      emoji: '⛈️' },
  95: { label: 'Thunderstorm',       emoji: '⛈️' },
  96: { label: 'Thunderstorm + Hail',emoji: '⛈️' },
  99: { label: 'Heavy Thunderstorm', emoji: '⛈️' },
};

class WeatherService {

  async getForecast(lat = 11.5742, lon = 37.3614) {
    try {
      // Open-Meteo: current + daily forecast, no API key needed
      const url = [
        'https://api.open-meteo.com/v1/forecast',
        `?latitude=${lat}&longitude=${lon}`,
        '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
        '&timezone=Africa%2FAddis_Ababa',
        '&forecast_days=7'
      ].join('');

      const response = await axios.get(url, { timeout: 8000 });
      const { current, daily } = response.data;

      const code    = current.weather_code;
      const wmo     = WMO_CODES[code] || { label: 'Unknown', emoji: '🌡️' };
      const rainPct = daily.precipitation_probability_max[0] ?? 0;

      // 7-day forecast
      const forecast7 = daily.time.map((date, i) => ({
        date:        date,
        code:        daily.weather_code[i],
        label:       (WMO_CODES[daily.weather_code[i]] || { label: 'Unknown' }).label,
        emoji:       (WMO_CODES[daily.weather_code[i]] || { emoji: '🌡️' }).emoji,
        tempMax:     daily.temperature_2m_max[i],
        tempMin:     daily.temperature_2m_min[i],
        rainChance:  daily.precipitation_probability_max[i] ?? 0,
        rainMm:      daily.precipitation_sum[i] ?? 0,
      }));

      return {
        condition:         wmo.label,
        emoji:             wmo.emoji,
        temp:              Math.round(current.temperature_2m),
        humidity:          current.relative_humidity_2m,
        windSpeed:         current.wind_speed_10m,
        rainProbability:   rainPct,
        recommendPostpone: rainPct > 60,
        forecast:          rainPct > 60
          ? `Rain expected today (${rainPct}% chance). Consider postponing irrigation.`
          : `Low rain probability (${rainPct}%). Safe to irrigate.`,
        forecast7,
        mocked:            false,
        unavailable:       false,
        updatedAt:         new Date().toISOString(),
      };

    } catch (error) {
      console.error('[WeatherService] Failed to fetch from Open-Meteo:', error.message);

      // Return a clearly-labeled unavailable response — never fake data
      return {
        condition:         'Unavailable',
        emoji:             '📡',
        temp:              null,
        humidity:          null,
        windSpeed:         null,
        rainProbability:   null,
        recommendPostpone: false,
        forecast:          'Weather data is currently unavailable. Check your internet connection.',
        forecast7:         [],
        mocked:            false,
        unavailable:       true,
        updatedAt:         new Date().toISOString(),
      };
    }
  }
}

module.exports = new WeatherService();

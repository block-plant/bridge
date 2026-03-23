import { useState, useEffect } from "react";
import axios from "axios";

const getWeatherEmoji = (code) => {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code <= 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌤️";
};

const getWeatherDescription = (code) => {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code <= 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Rain showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
};

export const useWeather = (city) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city || city.trim() === "") return;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        // Step 1 — get coordinates from city name
        const geoRes = await axios.get(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
        );

        if (!geoRes.data.results?.length) return;

        const { latitude, longitude } = geoRes.data.results[0];

        // Step 2 — get weather from coordinates
        const weatherRes = await axios.get(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );

        const current = weatherRes.data.current_weather;
        setWeather({
          temp: Math.round(current.temperature),
          description: getWeatherDescription(current.weathercode),
          icon: getWeatherEmoji(current.weathercode),
        });
      } catch {
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [city]);

  return { weather, loading };
};
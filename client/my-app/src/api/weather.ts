import axios from 'axios';

export interface WeatherResp {
    current_weather: { temperature: number };
}

export async function getWeatherByCoords(
    lat: number,
    lon: number,
): Promise<number> {
    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const { data } = await axios.get<WeatherResp>(url);
    return data.current_weather.temperature;
}

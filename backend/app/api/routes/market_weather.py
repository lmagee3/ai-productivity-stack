from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(tags=["intel"])


class QuoteItem(BaseModel):
    symbol: str
    price: float | None = None
    change_percent: float | None = None
    as_of: str | None = None


class MarketQuotesResponse(BaseModel):
    provider: str
    provider_url: str
    free_tier_notes: str
    symbols: list[str]
    quotes: list[QuoteItem]
    stub: bool = True
    updated_at: str


class WeatherCurrentResponse(BaseModel):
    provider: str
    provider_url: str
    free_tier_notes: str
    location: str
    units: Literal["imperial", "metric"]
    temperature: float | None = None
    condition: str | None = None
    wind_mph: float | None = None
    humidity: float | None = None
    stub: bool = True
    updated_at: str


@router.get("/market/quotes", response_model=MarketQuotesResponse)
def market_quotes(
    symbols: str | None = Query(default=None),
) -> MarketQuotesResponse:
    settings = get_settings()
    raw_symbols = symbols or settings.MARKET_WATCHLIST
    parsed = [s.strip().upper() for s in raw_symbols.split(",") if s.strip()]
    quotes: list[QuoteItem] = []
    stub = True
    notes = "Set ALPHAVANTAGE_API_KEY for live quotes."

    if settings.ALPHAVANTAGE_API_KEY:
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            for symbol in parsed[:10]:
                try:
                    response = client.get(
                        "https://www.alphavantage.co/query",
                        params={
                            "function": "GLOBAL_QUOTE",
                            "symbol": symbol,
                            "apikey": settings.ALPHAVANTAGE_API_KEY,
                        },
                    )
                    response.raise_for_status()
                    payload = response.json().get("Global Quote", {})
                    price = float(payload.get("05. price")) if payload.get("05. price") else None
                    change = float(payload.get("10. change percent", "0").replace("%", "")) if payload.get("10. change percent") else None
                    quotes.append(
                        QuoteItem(
                            symbol=symbol,
                            price=price,
                            change_percent=change,
                            as_of=payload.get("07. latest trading day"),
                        )
                    )
                except Exception:
                    quotes.append(QuoteItem(symbol=symbol))
        stub = False
        notes = "Alpha Vantage free tier (limited request/minute and request/day)."

    if not quotes:
        quotes = [QuoteItem(symbol=s) for s in parsed]

    return MarketQuotesResponse(
        provider="Alpha Vantage",
        provider_url="https://www.alphavantage.co/",
        free_tier_notes=notes,
        symbols=parsed,
        quotes=quotes,
        stub=stub,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/weather/current", response_model=WeatherCurrentResponse)
def weather_current(
    location: str | None = Query(default=None),
    units: Literal["imperial", "metric"] = Query(default="imperial"),
) -> WeatherCurrentResponse:
    settings = get_settings()
    selected_location = location or settings.WEATHER_LOCATION
    temp = None
    condition = None
    wind_mph = None
    humidity = None
    stub = True
    notes = "Set OPENWEATHERMAP_API_KEY for live weather."

    if settings.OPENWEATHERMAP_API_KEY:
        try:
            with httpx.Client(timeout=8.0, follow_redirects=True) as client:
                geo = client.get(
                    "https://api.openweathermap.org/geo/1.0/direct",
                    params={"q": selected_location, "limit": 1, "appid": settings.OPENWEATHERMAP_API_KEY},
                )
                geo.raise_for_status()
                places = geo.json()
                if places:
                    lat = places[0]["lat"]
                    lon = places[0]["lon"]
                    weather = client.get(
                        "https://api.openweathermap.org/data/2.5/weather",
                        params={
                            "lat": lat,
                            "lon": lon,
                            "appid": settings.OPENWEATHERMAP_API_KEY,
                            "units": units,
                        },
                    )
                    weather.raise_for_status()
                    payload = weather.json()
                    temp = payload.get("main", {}).get("temp")
                    humidity = payload.get("main", {}).get("humidity")
                    condition = (payload.get("weather") or [{}])[0].get("main")
                    wind_speed = payload.get("wind", {}).get("speed")
                    wind_mph = float(wind_speed) if wind_speed is not None else None
                    if units == "metric" and wind_mph is not None:
                        wind_mph = round(wind_mph * 0.621371, 2)
                    stub = False
                    notes = "OpenWeatherMap free tier (API key required)."
        except Exception:
            pass

    return WeatherCurrentResponse(
        provider="OpenWeatherMap",
        provider_url="https://openweathermap.org/api",
        free_tier_notes=notes,
        location=selected_location,
        units=units,
        temperature=temp,
        condition=condition,
        wind_mph=wind_mph,
        humidity=humidity,
        stub=stub,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

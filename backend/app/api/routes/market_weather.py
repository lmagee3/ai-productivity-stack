from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

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
    symbols: str = Query(default="SPY,QQQ,AAPL,MSFT,NVDA"),
) -> MarketQuotesResponse:
    parsed = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    return MarketQuotesResponse(
        provider="Finnhub",
        provider_url="https://finnhub.io/",
        free_tier_notes="Free tier available with API key, limited requests/minute.",
        symbols=parsed,
        quotes=[QuoteItem(symbol=s) for s in parsed],
        stub=True,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/weather/current", response_model=WeatherCurrentResponse)
def weather_current(
    location: str = Query(default="Seattle,WA"),
    units: Literal["imperial", "metric"] = Query(default="imperial"),
) -> WeatherCurrentResponse:
    return WeatherCurrentResponse(
        provider="Open-Meteo",
        provider_url="https://open-meteo.com/",
        free_tier_notes="Free, no API key required for basic current weather.",
        location=location,
        units=units,
        temperature=None,
        condition=None,
        wind_mph=None,
        humidity=None,
        stub=True,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

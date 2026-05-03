from django.conf import settings
from django.http import JsonResponse
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.cache import cache_page
from datetime import datetime, timedelta
import csv
import io
import requests
import yfinance as yf
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def stock_history(request, symbol):
    """
    1년치 yfinance 종가 데이터를 반환
    URL 예시: GET /invest/stock-history/SPY/
    """
    try:
        end = datetime.today()
        start = end - timedelta(days=365)
        data = yf.download(
            symbol,
            start=start.strftime('%Y-%m-%d'),
            end=end.strftime('%Y-%m-%d'),
            progress=False
        )
        data = data.reset_index()
        chart_data = {
            "labels": [d.strftime("%Y-%m-%d") for d in data['Date']],
            "prices": list(data['Close']),
        }
        return JsonResponse(chart_data)
    except Exception as e:
        logger.error("stock_history error: %s", e, exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def fred_series(request):
    """
    FRED 시리즈 전체 관찰값을 반환.
    프론트에서는 ?series_id=DGS10&file_type=json&limit=2000&sort_order=asc 식으로 호출.
    settings.FRED_API_KEY 또는 환경변수에 API_KEY가 있으면 자동 주입됩니다.
    """
    # 1) 들어온 파라미터 로깅
    params = request.GET.copy()
    logger.debug("▶ Incoming fred_series params: %s", params)

    # 2) series_id 필수 검사
    if 'series_id' not in params:
        return JsonResponse({'error': 'series_id parameter is required'}, status=400)

    # 3) API 키 자동 주입
    if 'api_key' not in params:
        key = getattr(settings, 'FRED_API_KEY', None)
        if not key:
            return JsonResponse({'error': 'FRED_API_KEY 설정이 없습니다.'}, status=500)
        params['api_key'] = key

    base_url = "https://api.stlouisfed.org/fred/series/observations"
    try:
        # 4) 실제 호출
        resp = requests.get(base_url, params=params, timeout=10)
        # 5) 상태 코드·본문 로깅
        logger.debug("▶ FRED status: %s", resp.status_code)
        logger.debug("▶ FRED body: %s", resp.text[:500])

        # 6) HTTP 에러 발생 시 예외 던지지 않고 JSON으로 리턴
        try:
            data = resp.json()
        except ValueError:
            # JSON 파싱 실패
            return JsonResponse(
                {'error': 'FRED 비정상 응답', 'body': resp.text},
                status=resp.status_code
            )

        if resp.status_code != 200:
            # FRED가 자체 에러 JSON을 내려주는 경우
            return JsonResponse(data, status=resp.status_code, safe=False)

        # 7) observations 파싱 후 dates/values 형태로 반환
        obs = data.get('observations', [])
        dates = [o.get('date') for o in obs]
        values = [
            None if o.get('value') in ('.', '') else float(o.get('value'))
            for o in obs
        ]
        return JsonResponse({'dates': dates, 'values': values})
    except requests.RequestException as e:
        logger.error("fred_series request exception: %s", e, exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def fear_greed_index(request):
    """
    CNN Fear & Greed index
    GET /invest/fear-greed/
    """
    try:
        url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json().get('fear_and_greed', {})
        return JsonResponse({
            'score': data.get('score'),
            'rating': data.get('rating'),
            'timestamp': data.get('timestamp'),
        })
    except Exception as e:
        logger.error("fear_greed_index error: %s", e, exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def bitcoin_price(request):
    """
    Coinbase BTC-USD spot price
    GET /invest/bitcoin/
    """
    try:
        url = "https://api.coinbase.com/v2/prices/BTC-USD/spot"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json().get('data', {})
        amount = data.get('amount')
        return JsonResponse({
            'price': float(amount) if amount else None,
            'currency': data.get('currency'),
        })
    except Exception as e:
        logger.error("bitcoin_price error: %s", e, exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def market_signals(request):
    """
    간단 통합 신호:
      - VIX (^VIX)
      - SPY/TLT 비율
      - Bitcoin
      - Fear & Greed
      - (DGS10 등은 프론트에서 fred_series 사용을 권장)
    GET /invest/market-signals/
    """
    signals = {}
    try:
        # VIX
        try:
            vix = yf.download('^VIX', period='5d', progress=False)
            if not vix.empty:
                latest = float(vix['Close'].iloc[-1])
                signals['vix'] = {
                    'value': latest,
                    'signal': 'fear' if latest > 30 else ('greed' if latest < 15 else 'neutral')
                }
        except Exception as e:
            logger.warning("vix fetch failed: %s", e)
            signals['vix'] = {'error': 'vix fetch failed'}

        # SPY/TLT ratio
        try:
            spy = yf.download('SPY', period='10d', progress=False)
            tlt = yf.download('TLT', period='10d', progress=False)
            if not spy.empty and not tlt.empty:
                spy_latest = float(spy['Close'].iloc[-1])
                tlt_latest = float(tlt['Close'].iloc[-1])
                ratio = spy_latest / tlt_latest if tlt_latest else None
                signals['spy_tlt'] = {
                    'spy': spy_latest, 'tlt': tlt_latest, 'ratio': ratio
                }
        except Exception as e:
            logger.warning("spy/tlt fetch failed: %s", e)
            signals['spy_tlt'] = {'error': 'spy/tlt fetch failed'}

        # Bitcoin
        try:
            btc = requests.get(
                "https://api.coinbase.com/v2/prices/BTC-USD/spot",
                timeout=10
            )
            btc.raise_for_status()
            data = btc.json().get('data', {})
            amt = data.get('amount')
            signals['bitcoin'] = {'price': float(amt) if amt else None}
        except Exception as e:
            logger.warning("btc fetch failed: %s", e)
            signals['bitcoin'] = {'error': 'btc fetch failed'}

        # Fear & Greed
        try:
            fg = requests.get(
                "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
                timeout=10
            )
            fg.raise_for_status()
            data = fg.json().get('fear_and_greed', {})
            signals['fear_greed'] = {
                'score': data.get('score'),
                'rating': data.get('rating')
            }
        except Exception as e:
            logger.warning("fear & greed fetch failed: %s", e)
            signals['fear_greed'] = {'error': 'fg fetch failed'}

        # 안내 노트
        signals['note'] = (
            'For precise treasury yields, use FRED via /invest/fred-series/?series_id=DGS10…'
        )

        return JsonResponse(signals)
    except Exception as e:
        logger.error("market_signals error: %s", e, exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


# =====================================================================
# 나스닥-100 구성종목 (Invesco QQQ ETF holdings 기반)
# ---------------------------------------------------------------------
# QQQ 는 나스닥-100을 추종하는 ETF로, Invesco가 매일 보유종목 CSV를 무료
# 공개합니다. NDX 자체 라이선스 없이 합법적으로 구성종목을 확보할 수 있는
# 가장 안정적인 무료 경로입니다. 6시간 캐싱으로 외부 호출을 최소화하고,
# CSV 컬럼명이 일부 바뀔 가능성에 대비해 여러 alias를 시도합니다.
# =====================================================================

QQQ_HOLDINGS_URL = (
    "https://www.invesco.com/us/financial-products/etfs/holdings"
    "?audienceType=Investor&action=download&ticker=QQQ"
)

# Invesco/기타 소스가 쓰는 섹터명 표기 차이를 GICS 표준으로 통일
SECTOR_NORMALIZE = {
    "Technology": "Information Technology",
    "Tech": "Information Technology",
    "Healthcare": "Health Care",
    "Health": "Health Care",
    "Telecommunications": "Communication Services",
    "Telecommunication Services": "Communication Services",
    "Telecom Services": "Communication Services",
    "Communications": "Communication Services",
    "Real Estate Investment Trusts (REITs)": "Real Estate",
}

NDX100_CACHE_KEY = "ndx100_qqq_holdings_v1"
NDX100_CACHE_TTL = 60 * 60 * 6  # 6시간


def _normalize_sector(s):
    if not s:
        return ""
    s = s.strip()
    return SECTOR_NORMALIZE.get(s, s)


def _parse_qqq_csv(text):
    """Invesco QQQ holdings CSV → [{ticker, name, sector, weight}, ...]"""
    reader = csv.DictReader(io.StringIO(text))
    items = []
    for row in reader:
        # 컬럼명이 'Holding Ticker' / 'Ticker' 등으로 다를 수 있어 alias 시도
        ticker = (
            row.get("Holding Ticker")
            or row.get("Ticker")
            or row.get("StockTicker")
            or ""
        ).strip()
        name = (
            row.get("Name")
            or row.get("Holding")
            or row.get("Description")
            or ""
        ).strip()
        sector_raw = (row.get("Sector") or "").strip()
        weight_raw = (
            row.get("Weight")
            or row.get("Weight (%)")
            or row.get("PercentageOfFund")
            or "0"
        ).strip().replace("%", "").replace(",", "")
        try:
            weight = float(weight_raw) if weight_raw else 0.0
        except ValueError:
            weight = 0.0

        if not ticker:
            continue
        # 현금/스왑/캐시컬렉터럴 등 제외
        if ticker.upper() in {"CASH", "USD", "SWAP", "-", "MMF"}:
            continue

        items.append({
            "ticker": ticker,
            "name": name,
            "sector": _normalize_sector(sector_raw),
            "weight": round(weight, 4),
        })
    return items


@api_view(['GET'])
@permission_classes([AllowAny])
def ndx100_list(request):
    """
    GET /invest/ndx100/?quarter=YYYY-MM-DD
    Invesco QQQ holdings 기반 NDX-100 구성종목을 반환.
    응답: { items: [{ticker,name,sector,weight}], count, source, quarter }
    """
    quarter = request.GET.get("quarter")  # 메타로만 echo, 분기 필터링은 미적용

    cached = cache.get(NDX100_CACHE_KEY)
    if cached:
        return JsonResponse({
            "items": cached,
            "count": len(cached),
            "source": "invesco_qqq_cached",
            "quarter": quarter,
        })

    try:
        resp = requests.get(
            QQQ_HOLDINGS_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; ndx100-fetcher)",
                "Accept": "text/csv,application/csv,*/*",
            },
            timeout=15,
            allow_redirects=True,
        )
        resp.raise_for_status()
        text = resp.content.decode("utf-8-sig", errors="replace")
        items = _parse_qqq_csv(text)

        if not items:
            raise ValueError("Invesco CSV에서 종목을 추출하지 못했습니다.")

        # 가중치 내림차순
        items.sort(key=lambda x: -x["weight"])

        cache.set(NDX100_CACHE_KEY, items, NDX100_CACHE_TTL)
        return JsonResponse({
            "items": items,
            "count": len(items),
            "source": "invesco_qqq",
            "quarter": quarter,
        })
    except Exception as e:
        logger.error("ndx100_list error: %s", e, exc_info=True)
        return JsonResponse({
            "error": "NDX 100 데이터 로드 실패",
            "detail": str(e),
            "items": [],
            "source": "error",
        }, status=502)
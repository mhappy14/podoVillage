from django.conf import settings
from django.http import JsonResponse
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.cache import cache_page
from datetime import datetime, timedelta
import csv
import io
import re
import html as html_lib
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
@cache_page(60 * 60)  # 1시간 캐시 (장중에도 빈번한 재호출 방지)
def ohlcv(request):
    """
    yfinance OHLCV 캔들 데이터 반환
    GET /invest/ohlcv/?symbol=^NDX&years=8
    응답: [{ date, open, high, low, close, volume }, ...]
    """
    symbol = request.GET.get('symbol', '^NDX').strip()
    try:
        years = max(1, min(10, int(request.GET.get('years', 8))))
    except (ValueError, TypeError):
        years = 8

    try:
        end = datetime.today()
        start = end - timedelta(days=years * 365)
        ticker = yf.Ticker(symbol)
        df = ticker.history(
            start=start.strftime('%Y-%m-%d'),
            end=end.strftime('%Y-%m-%d'),
            interval='1d',
            auto_adjust=True,
        )
        if df.empty:
            return JsonResponse({'error': f'{symbol} 데이터 없음'}, status=404)

        df = df.reset_index()
        # Ticker.history() 는 DatetimeTZDtype 인덱스를 반환할 수 있음
        date_col = df.columns[0]  # 'Date' 또는 'Datetime'
        candles = []
        for _, row in df.iterrows():
            dt = row[date_col]
            if hasattr(dt, 'strftime'):
                date_str = dt.strftime('%Y-%m-%d')
            else:
                date_str = str(dt)[:10]
            candles.append({
                'date':   date_str,
                'open':   round(float(row['Open']),   4),
                'high':   round(float(row['High']),   4),
                'low':    round(float(row['Low']),    4),
                'close':  round(float(row['Close']),  4),
                'volume': int(row.get('Volume', 0) or 0),
            })
        return JsonResponse(candles, safe=False)
    except Exception as e:
        logger.error("ohlcv error symbol=%s: %s", symbol, e, exc_info=True)
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
# 나스닥-100 구성종목 (다중 소스 fallback)
# ---------------------------------------------------------------------
# 1순위: Slickcharts (HTML, ticker+name+weight 안정적 무료 제공)
# 2순위: Invesco QQQ holdings CSV (URL 변경 시 부활용 retry)
# 3순위: Wikipedia API (백업)
# 섹터: Slickcharts/위키에는 GICS 섹터가 없거나 부정확하므로
#       백엔드 자체 정적 매핑(TICKER_TO_SECTOR)으로 보강.
# 캐시: 성공 시 6시간.
# =====================================================================

SLICKCHARTS_NDX_URL = "https://www.slickcharts.com/nasdaq100"
QQQ_HOLDINGS_URL = (
    "https://www.invesco.com/us/financial-products/etfs/holdings"
    "?audienceType=Investor&action=download&ticker=QQQ"
)

NDX100_CACHE_KEY = "ndx100_holdings_v2"
NDX100_CACHE_TTL = 60 * 60 * 6  # 6시간

SECTOR_NORMALIZE = {
    "Technology": "Information Technology",
    "Tech": "Information Technology",
    "Healthcare": "Health Care",
    "Health": "Health Care",
    "Telecommunications": "Communication Services",
    "Telecommunication Services": "Communication Services",
    "Telecom Services": "Communication Services",
    "Communications": "Communication Services",
}

# GICS 섹터 정적 매핑 (분기마다 신규 편입 종목 추가 필요)
TICKER_TO_SECTOR = {
    "AAPL": "Information Technology", "MSFT": "Information Technology",
    "NVDA": "Information Technology", "AMZN": "Consumer Discretionary",
    "GOOGL": "Communication Services", "GOOG": "Communication Services",
    "META": "Communication Services", "AVGO": "Information Technology",
    "TSLA": "Consumer Discretionary", "COST": "Consumer Staples",
    "NFLX": "Communication Services", "ADBE": "Information Technology",
    "AMD": "Information Technology", "CSCO": "Information Technology",
    "PEP": "Consumer Staples", "TMUS": "Communication Services",
    "INTU": "Information Technology", "AMGN": "Health Care",
    "TXN": "Information Technology", "QCOM": "Information Technology",
    "ISRG": "Health Care", "AMAT": "Information Technology",
    "BKNG": "Consumer Discretionary", "HON": "Industrials",
    "CMCSA": "Communication Services", "VRTX": "Health Care",
    "SBUX": "Consumer Discretionary", "GILD": "Health Care",
    "MU": "Information Technology", "LRCX": "Information Technology",
    "ADI": "Information Technology", "MDLZ": "Consumer Staples",
    "INTC": "Information Technology", "REGN": "Health Care",
    "ADP": "Industrials", "KLAC": "Information Technology",
    "PANW": "Information Technology", "SNPS": "Information Technology",
    "CDNS": "Information Technology", "ABNB": "Consumer Discretionary",
    "CRWD": "Information Technology", "MELI": "Consumer Discretionary",
    "MAR": "Consumer Discretionary", "FTNT": "Information Technology",
    "ORLY": "Consumer Discretionary", "ASML": "Information Technology",
    "ROP": "Industrials", "MRVL": "Information Technology",
    "DASH": "Consumer Discretionary", "NXPI": "Information Technology",
    "PCAR": "Industrials", "CTAS": "Industrials",
    "ADSK": "Information Technology", "MNST": "Consumer Staples",
    "AEP": "Utilities", "CHTR": "Communication Services",
    "MCHP": "Information Technology", "WDAY": "Information Technology",
    "AZN": "Health Care", "PYPL": "Financials",
    "KDP": "Consumer Staples", "CPRT": "Industrials",
    "EXC": "Utilities", "IDXX": "Health Care",
    "DDOG": "Information Technology", "CSGP": "Industrials",
    "ROST": "Consumer Discretionary", "FANG": "Energy",
    "FAST": "Industrials", "GEHC": "Health Care",
    "KHC": "Consumer Staples", "BKR": "Energy",
    "CCEP": "Consumer Staples", "ODFL": "Industrials",
    "ON": "Information Technology", "PAYX": "Industrials",
    "EA": "Communication Services", "VRSK": "Industrials",
    "BIIB": "Health Care", "XEL": "Utilities",
    "ZS": "Information Technology", "ANSS": "Information Technology",
    "CTSH": "Information Technology", "CDW": "Information Technology",
    "TTD": "Information Technology", "LULU": "Consumer Discretionary",
    "GFS": "Information Technology", "DXCM": "Health Care",
    "MDB": "Information Technology", "ARM": "Information Technology",
    "WBD": "Communication Services", "TEAM": "Information Technology",
    "DLTR": "Consumer Discretionary", "LIN": "Materials",
    "PDD": "Consumer Discretionary", "PLTR": "Information Technology",
    "APP": "Information Technology", "MSTR": "Information Technology",
    "CEG": "Utilities", "TTWO": "Communication Services",
    "CSX": "Industrials", "ALGN": "Health Care",
}


def _normalize_sector(s):
    if not s:
        return ""
    s = s.strip()
    return SECTOR_NORMALIZE.get(s, s)


def _enrich_sector(items):
    """tickers에 정적 섹터 매핑을 채워넣음 (이미 sector가 있으면 정규화만)"""
    for it in items:
        existing = it.get("sector")
        if existing:
            it["sector"] = _normalize_sector(existing)
        else:
            it["sector"] = TICKER_TO_SECTOR.get(it["ticker"], "Other")
    return items


# ---------- 1순위: Slickcharts ----------
TR_RE = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL | re.IGNORECASE)
TD_RE = re.compile(r'<td[^>]*>(.*?)</td>', re.DOTALL | re.IGNORECASE)
TAG_RE = re.compile(r'<[^>]+>')
TICKER_VALID_RE = re.compile(r'^[A-Z][A-Z0-9.\-]{0,7}$')


def _strip_html(s):
    """HTML 태그 제거 + 엔티티 디코딩"""
    return html_lib.unescape(TAG_RE.sub("", s)).strip()


def _parse_table_rows(html_text):
    """<tr>/<td> 위치 기반으로 [{ticker,name,weight}] 추출.
    Slickcharts/Wikipedia 등 표 구조 차이를 휴리스틱으로 흡수.
    컬럼 순서: 0=rank, 1=company, 2=ticker, 3=weight 가 일반적이지만
    회사명·티커 위치가 바뀌어도 ticker 정규식으로 자동 식별.
    """
    items = []
    for tr in TR_RE.findall(html_text):
        tds = [_strip_html(td) for td in TD_RE.findall(tr)]
        if len(tds) < 3:
            continue

        # rank 컬럼 (정수만) 인지 확인 — 헤더 행 제외
        if not (tds[0].isdigit() or (tds[0] and tds[0].rstrip(".").isdigit())):
            continue

        # ticker 후보 = 셀 중 ticker 정규식에 매칭되는 첫번째
        ticker = ""
        ticker_idx = -1
        for i, cell in enumerate(tds[1:], start=1):
            if TICKER_VALID_RE.match(cell):
                ticker = cell
                ticker_idx = i
                break
        if not ticker:
            continue

        # name = ticker 셀 직전 또는 직후 중 ticker 정규식에 안 맞는 첫 번째 텍스트
        name = ""
        for i in (ticker_idx - 1, ticker_idx + 1, ticker_idx - 2, ticker_idx + 2):
            if 1 <= i < len(tds) and tds[i] and not TICKER_VALID_RE.match(tds[i]):
                name = tds[i]
                break

        # weight = ticker 이후의 첫 번째 소수점 숫자 셀
        weight = 0.0
        for cell in tds[ticker_idx + 1:]:
            cleaned = cell.replace("%", "").replace(",", "").strip()
            try:
                w = float(cleaned)
                # rank 같이 정수가 다시 나올 수도 있으니 소수점이 있는 경우만 채택
                if "." in cleaned:
                    weight = w
                    break
                # 소수점 없어도 0 < w < 100 이면 weight로 간주
                if 0 < w < 100:
                    weight = w
                    break
            except ValueError:
                continue

        items.append({
            "ticker": ticker,
            "name": name or ticker,
            "sector": "",
            "weight": round(weight, 4),
        })
    return items


def _fetch_slickcharts():
    resp = requests.get(
        SLICKCHARTS_NDX_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.slickcharts.com/",
        },
        timeout=15,
    )
    resp.raise_for_status()
    text = resp.text
    items = _parse_table_rows(text)
    if not items:
        # 파싱 0건이면 응답 앞부분을 로그에 남겨 진단 가능하게
        snippet = text[:600].replace("\n", " ")
        logger.warning("[slickcharts] 파싱 0건 — 본문 앞 600자: %s", snippet)
    return items


# ---------- 3순위: Wikipedia API ----------
WIKIPEDIA_NDX_URL = (
    "https://en.wikipedia.org/w/api.php"
    "?action=parse&page=Nasdaq-100&format=json&prop=text&redirects=1"
)


def _fetch_wikipedia():
    resp = requests.get(
        WIKIPEDIA_NDX_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; ndx100-fetcher)"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    html_text = data.get("parse", {}).get("text", {}).get("*", "")
    if not html_text:
        return []
    items = _parse_table_rows(html_text)
    if not items:
        snippet = html_text[:600].replace("\n", " ")
        logger.warning("[wikipedia] 파싱 0건 — 본문 앞 600자: %s", snippet)
    return items


# ---------- 2순위: Invesco CSV (URL 부활 시 자동 사용) ----------
def _parse_qqq_csv(text):
    reader = csv.DictReader(io.StringIO(text))
    items = []
    for row in reader:
        ticker = (
            row.get("Holding Ticker") or row.get("Ticker")
            or row.get("StockTicker") or ""
        ).strip()
        name = (
            row.get("Name") or row.get("Holding") or row.get("Description") or ""
        ).strip()
        sector_raw = (row.get("Sector") or "").strip()
        weight_raw = (
            row.get("Weight") or row.get("Weight (%)")
            or row.get("PercentageOfFund") or "0"
        ).strip().replace("%", "").replace(",", "")
        try:
            weight = float(weight_raw) if weight_raw else 0.0
        except ValueError:
            weight = 0.0
        if not ticker:
            continue
        if ticker.upper() in {"CASH", "USD", "SWAP", "-", "MMF"}:
            continue
        items.append({
            "ticker": ticker, "name": name,
            "sector": sector_raw, "weight": round(weight, 4),
        })
    return items


def _fetch_invesco():
    resp = requests.get(
        QQQ_HOLDINGS_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ndx100-fetcher)",
            "Accept": "text/csv,application/csv,*/*",
        },
        timeout=15,
        allow_redirects=False,  # HTML 리디렉트 거부 → 깨졌는지 즉시 판별
    )
    if resp.status_code in (301, 302, 303, 307, 308):
        raise ValueError(f"Invesco URL 리디렉트 ({resp.status_code}) — 다운로드 엔드포인트가 폐기됨")
    resp.raise_for_status()
    ctype = resp.headers.get("Content-Type", "")
    if "csv" not in ctype.lower() and "octet" not in ctype.lower():
        raise ValueError(f"CSV 아닌 응답 (Content-Type: {ctype})")
    text = resp.content.decode("utf-8-sig", errors="replace")
    return _parse_qqq_csv(text)


@api_view(['GET'])
@permission_classes([AllowAny])
def ndx100_list(request):
    """
    GET /invest/ndx100/?quarter=YYYY-MM-DD
    응답: { items: [{ticker,name,sector,weight}], count, source, quarter, sources_tried }
    """
    quarter = request.GET.get("quarter")

    cached = cache.get(NDX100_CACHE_KEY)
    if cached:
        return JsonResponse({
            "items": cached["items"],
            "count": len(cached["items"]),
            "source": cached["source"] + "_cached",
            "quarter": quarter,
        })

    sources_tried = []

    # 1순위: Slickcharts
    try:
        items = _fetch_slickcharts()
        if items:
            items = _enrich_sector(items)
            items.sort(key=lambda x: -x["weight"])
            cache.set(NDX100_CACHE_KEY, {"items": items, "source": "slickcharts"}, NDX100_CACHE_TTL)
            return JsonResponse({
                "items": items, "count": len(items),
                "source": "slickcharts", "quarter": quarter,
            })
        sources_tried.append("slickcharts: empty result")
    except Exception as e:
        logger.warning("slickcharts fetch failed: %s", e)
        sources_tried.append(f"slickcharts: {e}")

    # 2순위: Invesco (현재 깨져있지만 부활 시 자동 활성화)
    try:
        items = _fetch_invesco()
        if items:
            items = _enrich_sector(items)
            items.sort(key=lambda x: -x["weight"])
            cache.set(NDX100_CACHE_KEY, {"items": items, "source": "invesco_qqq"}, NDX100_CACHE_TTL)
            return JsonResponse({
                "items": items, "count": len(items),
                "source": "invesco_qqq", "quarter": quarter,
            })
        sources_tried.append("invesco_qqq: empty result")
    except Exception as e:
        logger.warning("invesco fetch failed: %s", e)
        sources_tried.append(f"invesco_qqq: {e}")

    # 3순위: Wikipedia API
    try:
        items = _fetch_wikipedia()
        if items:
            items = _enrich_sector(items)
            items.sort(key=lambda x: -x["weight"] if x["weight"] else 0)
            cache.set(NDX100_CACHE_KEY, {"items": items, "source": "wikipedia"}, NDX100_CACHE_TTL)
            return JsonResponse({
                "items": items, "count": len(items),
                "source": "wikipedia", "quarter": quarter,
            })
        sources_tried.append("wikipedia: empty result")
    except Exception as e:
        logger.warning("wikipedia fetch failed: %s", e)
        sources_tried.append(f"wikipedia: {e}")

    # 모든 소스 실패
    logger.error("ndx100_list — all sources failed: %s", sources_tried)
    return JsonResponse({
        "error": "NDX 100 데이터 로드 실패 (모든 소스)",
        "sources_tried": sources_tried,
        "items": [], "source": "error", "quarter": quarter,
    }, status=502)

# =====================================================================
# 매크로 지표 스냅샷 (FRED + yfinance + 합성) — 백엔드 저장 + 일일 갱신
# =====================================================================
from app.models import IndicatorSnapshot
from django.utils.dateparse import parse_date as _parse_date
import datetime as _dt


# 지표 정의 — 프론트의 SECTIONS 와 동일 구조의 source-of-truth
# kind: 'fred' / 'yfinance' / 'computed' / 'unavailable'
INDICATOR_DEFS = [
    # 1. 금리
    {"key": "DFEDTARU", "kind": "fred", "ref": "DFEDTARU"},
    {"key": "DGS10", "kind": "fred", "ref": "DGS10"},
    {"key": "T10Y2Y", "kind": "fred", "ref": "T10Y2Y"},
    {"key": "DFII10", "kind": "fred", "ref": "DFII10"},

    # 2. 시장 — 대부분 라이선스, MOVE만 yfinance 시도
    {"key": "SIFMA",   "kind": "unavailable"},
    {"key": "TIC",     "kind": "unavailable"},
    {"key": "MOVE",    "kind": "yfinance", "ref": "^MOVE"},
    {"key": "COT",     "kind": "unavailable"},

    # 3. 유동성
    {"key": "M2SL", "kind": "fred", "ref": "M2SL"},
    # 합성 지표지만 갱신일은 대표 구성 시리즈(WALCL, 주간 발표)의 FRED last_updated 사용
    {"key": "NETLIQ", "kind": "computed", "ref": "net_liquidity", "updated_from": "WALCL"},
    {"key": "SOFR", "kind": "fred", "ref": "SOFR"},
    {"key": "DTWEXBGS", "kind": "fred", "ref": "DTWEXBGS"},

    # 4. 경기
    {"key": "CPIAUCSL", "kind": "fred", "ref": "CPIAUCSL"},
    {"key": "UNRATE", "kind": "fred", "ref": "UNRATE"},
    # ISM Mfg PMI: 라이선스 데이터라 직접 무료 제공 X.
    # Philly Fed Mfg General Activity 를 프록시로 사용 (ISM 과 상관계수 ~0.8)
    {"key": "ISM_MFG", "kind": "fred", "ref": "GACDFSA066MSFRBPHI"},
    {"key": "ISM_SVC",  "kind": "unavailable"},
    {"key": "GOLD",     "kind": "fred", "ref": "GOLDAMGBD228NLBM"},
    {"key": "COPPER",   "kind": "fred", "ref": "PCOPPUSDM"},
    {"key": "SOX",      "kind": "yfinance", "ref": "^SOX"},

    # 5. 신용
    {"key": "BAMLH0A0HYM2", "kind": "fred", "ref": "BAMLH0A0HYM2"},
    {"key": "DRTSCILM",     "kind": "fred", "ref": "DRTSCILM"},

    # 6. 심리
    {"key": "VIXCLS", "kind": "fred", "ref": "VIXCLS"},
    {"key": "SPY_TLT", "kind": "computed", "ref": "spy_tlt_ratio"},
    {"key": "FUNDFLOW", "kind": "unavailable"},
]


def _quarter_start(d):
    m = ((d.month - 1) // 3) * 3 + 1
    return _dt.date(d.year, m, 1)

def _add_quarters(d, n):
    m_total = (d.year * 12 + (d.month - 1)) + n * 3
    return _dt.date(m_total // 12, m_total % 12 + 1, 1)

def _add_years(d, n):
    return _dt.date(d.year + n, d.month, d.day)


# ---------- FRED 단일 시리즈 ----------
def _fetch_fred_at(series_id, end_date):
    key = getattr(settings, "FRED_API_KEY", None)
    if not key:
        return None
    try:
        resp = requests.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params={
                "series_id": series_id,
                "api_key": key,
                "file_type": "json",
                "sort_order": "desc",
                "observation_end": end_date.strftime("%Y-%m-%d"),
                "limit": 60,
            },
            timeout=15,
        )
        resp.raise_for_status()
        for o in (resp.json().get("observations") or []):
            v = o.get("value")
            if v and v != ".":
                return {"date": o["date"], "value": float(v)}
        return None
    except Exception as e:
        logger.warning("[FRED] %s @%s 실패: %s", series_id, end_date, e)
        return None


# ---------- FRED 시리즈 메타 (Updated 날짜) ----------
def _fetch_fred_last_updated(series_id):
    """FRED /series 엔드포인트의 last_updated (시리즈 갱신일) 를 date 로 반환."""
    key = getattr(settings, "FRED_API_KEY", None)
    if not key:
        return None
    try:
        resp = requests.get(
            "https://api.stlouisfed.org/fred/series",
            params={
                "series_id": series_id,
                "api_key": key,
                "file_type": "json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        seriess = resp.json().get("seriess") or []
        if not seriess:
            return None
        lu = seriess[0].get("last_updated")  # 예: "2026-04-02 07:31:02-05"
        if not lu:
            return None
        return _parse_date(lu[:10])
    except Exception as e:
        logger.warning("[FRED] %s last_updated 실패: %s", series_id, e)
        return None


# ---------- FRED 차기(예정) 발표일 ----------
def _fetch_fred_next_release(series_id):
    """시리즈가 속한 release 의 다음 예정 발표일(오늘 이후 가장 이른 날짜)을 반환.
    예정 발표일이 공시되지 않은 시리즈는 None."""
    key = getattr(settings, "FRED_API_KEY", None)
    if not key:
        return None
    try:
        # 1) 시리즈 → release_id
        r1 = requests.get(
            "https://api.stlouisfed.org/fred/series/release",
            params={"series_id": series_id, "api_key": key, "file_type": "json"},
            timeout=15,
        )
        r1.raise_for_status()
        releases = r1.json().get("releases") or []
        release_id = releases[0].get("id") if releases else None
        if release_id is None:
            return None
        # 2) release 의 발표일 목록 — 예정일 포함하려면 realtime_end 를 미래로
        today = _dt.date.today()
        r2 = requests.get(
            "https://api.stlouisfed.org/fred/release/dates",
            params={
                "release_id": release_id,
                "api_key": key,
                "file_type": "json",
                "include_release_dates_with_no_data": "true",
                "sort_order": "asc",
                "realtime_start": today.strftime("%Y-%m-%d"),
                "realtime_end": "9999-12-31",
                "limit": 100,
            },
            timeout=15,
        )
        r2.raise_for_status()
        for d in (r2.json().get("release_dates") or []):
            dd = _parse_date(d.get("date") or "")
            if dd and dd > today:
                return dd
        return None
    except Exception as e:
        logger.warning("[FRED] %s next_release 실패: %s", series_id, e)
        return None


# ---------- yfinance ----------
def _fetch_yf_at(symbol, end_date):
    try:
        # 60일치 받아서 end_date 이전 가장 가까운 종가
        start = end_date - _dt.timedelta(days=60)
        df = yf.download(
            symbol,
            start=start.strftime("%Y-%m-%d"),
            end=(end_date + _dt.timedelta(days=1)).strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=True,
            threads=False,
        )
        if df is None or df.empty:
            return None
        # yfinance가 multi-index DataFrame을 반환하는 경우 단일 컬럼으로 변환
        close = df["Close"]
        if hasattr(close, "iloc") and hasattr(close, "columns"):
            close = close.iloc[:, 0]
        last = close.dropna()
        if last.empty:
            return None
        last_date = last.index[-1].date().isoformat()
        return {"date": last_date, "value": float(last.iloc[-1])}
    except Exception as e:
        logger.warning("[yfinance] %s @%s 실패: %s", symbol, end_date, e)
        return None


# ---------- 합성 지표 ----------
def _compute_net_liquidity(end_date):
    """Net Liquidity = WALCL − WTREGEN − RRPONTSYD (단위: 10억$)"""
    walcl = _fetch_fred_at("WALCL", end_date)
    tga   = _fetch_fred_at("WTREGEN", end_date)
    rrp   = _fetch_fred_at("RRPONTSYD", end_date)
    if not (walcl and tga and rrp):
        return None
    # FRED: WALCL/WTREGEN 단위는 백만 달러, RRPONTSYD는 십억 달러
    val = (walcl["value"] - tga["value"]) / 1000.0 - rrp["value"]
    return {"date": walcl["date"], "value": round(val, 2)}


def _compute_spy_tlt(end_date):
    spy = _fetch_yf_at("SPY", end_date)
    tlt = _fetch_yf_at("TLT", end_date)
    if not (spy and tlt) or tlt["value"] == 0:
        return None
    return {"date": spy["date"], "value": round(spy["value"] / tlt["value"], 4)}


# ---------- 디스패처 ----------
def _fetch_indicator_at(defn, end_date):
    kind = defn["kind"]
    ref = defn.get("ref")
    if kind == "fred":
        return _fetch_fred_at(ref, end_date), "fred"
    if kind == "yfinance":
        return _fetch_yf_at(ref, end_date), "yfinance"
    if kind == "computed":
        if ref == "net_liquidity":
            return _compute_net_liquidity(end_date), "computed"
        if ref == "spy_tlt_ratio":
            return _compute_spy_tlt(end_date), "computed"
    return None, "unavailable"


def _uses_yfinance(defn):
    """yfinance 실시간 시세 기반 지표인지 (MOVE/SOX 및 SPY/TLT 합성)."""
    return defn.get("kind") == "yfinance" or defn.get("ref") == "spy_tlt_ratio"


def update_indicators_for_quarter(quarter_date):
    """주어진 분기 첫날을 기준으로 (current, prev_q, prev_y) 3개 anchor 모두 fetch + 저장"""
    anchors = {
        "current": quarter_date,
        "prev_q":  _add_quarters(quarter_date, -1),
        "prev_y":  _add_years(quarter_date, -1),
    }
    today = _dt.date.today()
    # 진행 중인 현재 분기를 갱신할 때만 yfinance(실시간) 지표의 current 앵커를
    # 분기 시작일이 아니라 '오늘' 기준으로 받아온다. (과거 분기 재계산 시엔 그대로)
    is_live_quarter = (quarter_date == _quarter_start(today))
    written = 0
    skipped = 0
    for defn in INDICATOR_DEFS:
        # 갱신일(Updated)·차기 발표일(next_release)은 anchor 와 무관하게 시리즈당 1회만 조회.
        # FRED 시리즈는 ref 로, 합성 지표(computed)는 updated_from 으로 지정한
        # 대표 FRED 시리즈를 메타데이터 기준으로 사용.
        if defn["kind"] == "fred" and defn.get("ref"):
            meta_series = defn["ref"]
        elif defn.get("updated_from"):
            meta_series = defn["updated_from"]
        else:
            meta_series = None
        if meta_series:
            series_updated = _fetch_fred_last_updated(meta_series)
            next_release = _fetch_fred_next_release(meta_series)
        else:
            series_updated = None
            next_release = None
        for anchor_key, anchor_date in anchors.items():
            # 실시간(yfinance) 지표의 현재 분기 current 앵커는 오늘 기준으로 fetch
            use_today = (
                anchor_key == "current" and is_live_quarter and _uses_yfinance(defn)
            )
            fetch_date = today if use_today else anchor_date
            obs, source = _fetch_indicator_at(defn, fetch_date)
            if obs and use_today:
                observation_date = today          # 실시간 값 → 관측일을 오늘로 표기
            elif obs:
                observation_date = _parse_date(obs["date"])
            else:
                observation_date = None
            obj, _ = IndicatorSnapshot.objects.update_or_create(
                indicator_key=defn["key"],
                quarter_anchor=anchor_key,
                quarter_date=quarter_date,
                defaults={
                    "observation_date": observation_date,
                    "series_updated": series_updated,
                    "next_release": next_release,
                    "value": obs["value"] if obs else None,
                    "source": source,
                },
            )
            if obs:
                written += 1
            else:
                skipped += 1
    return {"written": written, "skipped": skipped, "quarter": quarter_date.isoformat()}


@api_view(['GET'])
@permission_classes([AllowAny])
def indicator_snapshots(request):
    """
    GET /invest/indicator-snapshots/?quarter=YYYY-MM-DD
    DB에서 분기 스냅샷 읽어 반환. 비어있으면 즉시 fetch+저장 후 반환 (cold-start).
    응답: {
      quarter: '2026-04-01',
      indicators: {
        DGS10: { current: {date, updated, next_release, value, source}, prev_q: {...}, prev_y: {...} },
        ...
      }
    }
    """
    qstr = request.GET.get("quarter")
    qd = _parse_date(qstr) if qstr else _quarter_start(_dt.date.today())
    if qd is None:
        return JsonResponse({"error": "invalid quarter"}, status=400)

    rows = list(IndicatorSnapshot.objects.filter(quarter_date=qd))
    if not rows:
        # cold-start: 즉시 채움 (느릴 수 있음 — cron + management command 권장)
        try:
            update_indicators_for_quarter(qd)
            rows = list(IndicatorSnapshot.objects.filter(quarter_date=qd))
        except Exception as e:
            logger.error("indicator_snapshots cold-start 실패: %s", e, exc_info=True)
            return JsonResponse({"error": str(e)}, status=500)

    indicators = {}
    for r in rows:
        d = indicators.setdefault(r.indicator_key, {})
        d[r.quarter_anchor] = {
            "date": r.observation_date.isoformat() if r.observation_date else None,
            "updated": r.series_updated.isoformat() if r.series_updated else None,
            "next_release": r.next_release.isoformat() if r.next_release else None,
            "value": r.value,
            "source": r.source,
        }
    return JsonResponse({
        "quarter": qd.isoformat(),
        "indicators": indicators,
        "count": len(indicators),
        "fetched_at": max((r.fetched_at for r in rows), default=None).isoformat() if rows else None,
    })


# =====================================================================
# 지표별 5년 히스토리 — 차트용
# ---------------------------------------------------------------------
# GET /invest/indicator-history/?key=DGS10&years=5
# INDICATOR_DEFS 의 kind(fred/yfinance/computed) 에 따라 소스 자동 선택.
# 응답: { dates: [...], values: [...], kind, ref }
# 캐시: 1시간
# =====================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 60)
def indicator_history(request):
    key   = request.GET.get('key', '')
    years = min(max(int(request.GET.get('years', 5)), 1), 20)

    defn = next((d for d in INDICATOR_DEFS if d['key'] == key), None)
    if not defn:
        return JsonResponse({'error': f'Unknown indicator key: {key}'}, status=400)

    end_date   = _dt.date.today()
    start_date = _dt.date(end_date.year - years, end_date.month, end_date.day)
    kind       = defn['kind']
    ref        = defn.get('ref', '')

    # ── FRED ──────────────────────────────────────────────────────────
    if kind == 'fred':
        api_key = getattr(settings, 'FRED_API_KEY', None)
        if not api_key:
            return JsonResponse({'error': 'FRED_API_KEY 설정이 없습니다.'}, status=500)
        try:
            resp = requests.get(
                'https://api.stlouisfed.org/fred/series/observations',
                params={
                    'series_id':         ref,
                    'api_key':           api_key,
                    'file_type':         'json',
                    'sort_order':        'asc',
                    'observation_start': start_date.strftime('%Y-%m-%d'),
                    'observation_end':   end_date.strftime('%Y-%m-%d'),
                },
                timeout=15,
            )
            resp.raise_for_status()
            obs    = resp.json().get('observations', [])
            dates  = [o['date'] for o in obs]
            values = [None if o['value'] in ('.', '') else float(o['value']) for o in obs]
            return JsonResponse({'dates': dates, 'values': values, 'kind': 'fred', 'ref': ref})
        except Exception as e:
            logger.error("indicator_history FRED %s: %s", ref, e, exc_info=True)
            return JsonResponse({'error': str(e)}, status=500)

    # ── yfinance ──────────────────────────────────────────────────────
    if kind == 'yfinance':
        try:
            df = yf.download(
                ref,
                start=start_date.strftime('%Y-%m-%d'),
                end=end_date.strftime('%Y-%m-%d'),
                progress=False,
                auto_adjust=True,
                threads=False,
            )
            if df is None or df.empty:
                return JsonResponse({'dates': [], 'values': [], 'kind': 'yfinance', 'ref': ref})
            close = df['Close']
            if hasattr(close, 'columns'):
                close = close.iloc[:, 0]
            close = close.dropna()
            dates  = [d.date().isoformat() for d in close.index]
            values = [round(float(v), 4) for v in close]
            return JsonResponse({'dates': dates, 'values': values, 'kind': 'yfinance', 'ref': ref})
        except Exception as e:
            logger.error("indicator_history yfinance %s: %s", ref, e, exc_info=True)
            return JsonResponse({'error': str(e)}, status=500)

    # ── computed ──────────────────────────────────────────────────────
    if kind == 'computed':
        api_key = getattr(settings, 'FRED_API_KEY', None)

        def _fred_series(sid):
            r = requests.get(
                'https://api.stlouisfed.org/fred/series/observations',
                params={
                    'series_id':          sid,
                    'api_key':            api_key,
                    'file_type':          'json',
                    'sort_order':         'asc',
                    'frequency':          'w',
                    'aggregation_method': 'eop',
                    'observation_start':  start_date.strftime('%Y-%m-%d'),
                    'observation_end':    end_date.strftime('%Y-%m-%d'),
                },
                timeout=15,
            )
            r.raise_for_status()
            return {
                o['date']: float(o['value'])
                for o in r.json().get('observations', [])
                if o['value'] not in ('.', '')
            }

        if ref == 'net_liquidity':
            if not api_key:
                return JsonResponse({'error': 'FRED_API_KEY 설정이 없습니다.'}, status=500)
            try:
                walcl = _fred_series('WALCL')
                tga   = _fred_series('WTREGEN')
                rrp   = _fred_series('RRPONTSYD')
                common = sorted(set(walcl) & set(tga) & set(rrp))
                # WALCL/WTREGEN: 백만$ → /1000 = 십억$,  RRPONTSYD: 십억$
                dates  = common
                values = [round((walcl[d] - tga[d]) / 1000.0 - rrp[d], 2) for d in common]
                return JsonResponse({'dates': dates, 'values': values, 'kind': 'computed', 'ref': ref})
            except Exception as e:
                logger.error("indicator_history NETLIQ: %s", e, exc_info=True)
                return JsonResponse({'error': str(e)}, status=500)

        if ref == 'spy_tlt_ratio':
            try:
                spy_df = yf.download('SPY', start=start_date.strftime('%Y-%m-%d'),
                                     end=end_date.strftime('%Y-%m-%d'),
                                     progress=False, auto_adjust=True, threads=False)
                tlt_df = yf.download('TLT', start=start_date.strftime('%Y-%m-%d'),
                                     end=end_date.strftime('%Y-%m-%d'),
                                     progress=False, auto_adjust=True, threads=False)
                if spy_df.empty or tlt_df.empty:
                    return JsonResponse({'dates': [], 'values': [], 'kind': 'computed', 'ref': ref})
                spy_c  = spy_df['Close'].iloc[:, 0] if hasattr(spy_df['Close'], 'columns') else spy_df['Close']
                tlt_c  = tlt_df['Close'].iloc[:, 0] if hasattr(tlt_df['Close'], 'columns') else tlt_df['Close']
                ratio  = (spy_c / tlt_c).dropna()
                dates  = [d.date().isoformat() for d in ratio.index]
                values = [round(float(v), 4) for v in ratio]
                return JsonResponse({'dates': dates, 'values': values, 'kind': 'computed', 'ref': ref})
            except Exception as e:
                logger.error("indicator_history SPY_TLT: %s", e, exc_info=True)
                return JsonResponse({'error': str(e)}, status=500)

    # unavailable
    return JsonResponse({'dates': [], 'values': [], 'kind': 'unavailable', 'ref': ref})


# =====================================================================
# 개별 종목 지표 — StockDailyData DB + yfinance 실시간 보완
# ---------------------------------------------------------------------
# GET /invest/stock-indicators/<symbol>/
# 응답: {ticker, last_date, price, ma, volume, put_call, high_low, overall}
# =====================================================================
from app.models import StockDailyData
import numpy as np


def _ensure_stock_data(ticker: str) -> None:
    """DB에 최신 데이터가 없으면 yfinance로 400일치 fetch + upsert."""
    today = _dt.date.today()
    latest = (
        StockDailyData.objects
        .filter(ticker=ticker)
        .order_by("-date")
        .values_list("date", flat=True)
        .first()
    )
    # 최근 거래일이 2일 이상 오래됐을 때만 재수집 (주말/공휴일 고려 ≤3일)
    if latest and (today - latest).days <= 3:
        return

    try:
        start = (today - _dt.timedelta(days=420)).strftime("%Y-%m-%d")
        end   = (today + _dt.timedelta(days=1)).strftime("%Y-%m-%d")
        df = yf.download(ticker, start=start, end=end,
                         progress=False, auto_adjust=True, threads=False)
        if df is None or df.empty:
            return
        df = df.reset_index()
        # yfinance multi-index 대응
        if hasattr(df.columns, "levels"):
            df.columns = ["_".join(c).strip("_") for c in df.columns]

        rows = []
        for _, row in df.iterrows():
            date_val = row.get("Date") or row.get("date")
            if hasattr(date_val, "date"):
                date_val = date_val.date()
            close = _safe_float(row.get("Close") or row.get(f"Close_{ticker}"))
            if close is None:
                continue
            rows.append(StockDailyData(
                ticker      = ticker,
                date        = date_val,
                open_price  = _safe_float(row.get("Open")   or row.get(f"Open_{ticker}")),
                high_price  = _safe_float(row.get("High")   or row.get(f"High_{ticker}")),
                low_price   = _safe_float(row.get("Low")    or row.get(f"Low_{ticker}")),
                close_price = close,
                volume      = _safe_int(row.get("Volume")   or row.get(f"Volume_{ticker}")),
            ))

        # bulk upsert (update_or_create 루프 대신 ignore_conflicts=True)
        StockDailyData.objects.bulk_create(
            rows,
            update_conflicts=True,
            unique_fields=["ticker", "date"],
            update_fields=["open_price", "high_price", "low_price",
                           "close_price", "volume", "fetched_at"],
        )
        logger.info("[stock] %s: %d rows upserted", ticker, len(rows))
    except Exception as e:
        logger.warning("[stock] %s fetch 실패: %s", ticker, e)


def _safe_float(v):
    try:
        f = float(v)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def _safe_int(v):
    try:
        f = float(v)
        return None if (f != f) else int(f)
    except (TypeError, ValueError):
        return None


def _signal3(condition_bull, condition_bear):
    """단순 3값 시그널 헬퍼"""
    if condition_bull:
        return "bullish"
    if condition_bear:
        return "bearish"
    return "neutral"


def _compute_ma_block(rows):
    """rows: [StockDailyData ...] 날짜 오름차순"""
    closes = [r.close_price for r in rows if r.close_price is not None]
    dates  = [str(r.date)   for r in rows if r.close_price is not None]
    if len(closes) < 20:
        return None

    def ma(n):
        return [
            round(sum(closes[max(0, i - n + 1):i + 1]) / min(n, i + 1), 4)
            for i in range(len(closes))
        ]

    ma5  = ma(5)
    ma20 = ma(20)
    ma60 = ma(60)
    ma120= ma(120)

    # 최신값
    last_close = closes[-1]
    lma5, lma20, lma60, lma120 = ma5[-1], ma20[-1], ma60[-1], ma120[-1]

    aligned = lma5 > lma20 > lma60 > lma120
    pct_from_ma20 = round((last_close - lma20) / lma20 * 100, 2) if lma20 else None

    # 시그널: 기본 정배열 조건 (MA5 > MA20 > MA60)
    signal = _signal3(
        lma5 > lma20 and lma20 > lma60,
        lma5 < lma20 and lma20 < lma60,
    )

    # 60일치 히스토리 (차트용)
    hist_len = min(60, len(closes))
    history = [
        {
            "date": dates[-hist_len + i],
            "close": round(closes[-hist_len + i], 4),
            "ma5":  round(ma5[-hist_len + i], 4),
            "ma20": round(ma20[-hist_len + i], 4),
            "ma60": round(ma60[-hist_len + i], 4),
            "ma120":round(ma120[-hist_len + i], 4),
        }
        for i in range(hist_len)
    ]

    return {
        "ma5": round(lma5, 4), "ma20": round(lma20, 4),
        "ma60": round(lma60, 4), "ma120": round(lma120, 4),
        "close": round(last_close, 4),
        "aligned": aligned,
        "pct_from_ma20": pct_from_ma20,
        "signal": signal,
        "history": history,
    }


def _compute_volume_block(rows):
    closes  = [r.close_price for r in rows if r.close_price is not None and r.volume is not None]
    volumes = [r.volume      for r in rows if r.close_price is not None and r.volume is not None]
    dates   = [str(r.date)   for r in rows if r.close_price is not None and r.volume is not None]
    if len(volumes) < 5:
        return None

    # 20일 평균 거래량
    avg20 = sum(volumes[-20:]) / min(20, len(volumes))
    cur_vol = volumes[-1]
    vol_ratio = round(cur_vol / avg20, 4) if avg20 else None

    # OBV (On-Balance Volume)
    obv = [0]
    for i in range(1, len(closes)):
        if closes[i] > closes[i - 1]:
            obv.append(obv[-1] + volumes[i])
        elif closes[i] < closes[i - 1]:
            obv.append(obv[-1] - volumes[i])
        else:
            obv.append(obv[-1])

    # OBV 5일 기울기 부호 → 추세 방향
    obv_slope = (obv[-1] - obv[-6]) if len(obv) >= 6 else 0
    price_up  = closes[-1] > closes[-2] if len(closes) >= 2 else False

    # 거래강도 시그널: 거래량 증가 + OBV 상승 = bullish
    vol_high = vol_ratio and vol_ratio >= 1.2
    signal = _signal3(
        vol_high and obv_slope > 0,
        vol_high and obv_slope < 0,
    )

    hist_len = min(60, len(volumes))
    history = [
        {
            "date":      dates[-hist_len + i],
            "volume":    volumes[-hist_len + i],
            "vol_ratio": round(volumes[-hist_len + i] / avg20, 4) if avg20 else None,
            "obv":       obv[-hist_len + i],
        }
        for i in range(hist_len)
    ]

    return {
        "current_vol": cur_vol,
        "avg_vol_20":  round(avg20),
        "vol_ratio":   vol_ratio,
        "obv_slope_5d": obv_slope,
        "signal": signal,
        "history": history,
    }


def _compute_put_call(ticker: str):
    """yfinance 옵션 체인에서 P/C 비율 산출 (최근 3개 만기 합산)."""
    try:
        t = yf.Ticker(ticker)
        exps = t.options  # 만기일 목록 (tuple)
        if not exps:
            return {"ratio": None, "signal": "neutral", "note": "옵션 데이터 없음"}

        total_calls = 0
        total_puts  = 0
        used_exps   = exps[:3]  # 가장 가까운 3개 만기만
        for exp in used_exps:
            chain = t.option_chain(exp)
            c_vol = chain.calls["volume"].fillna(0).sum()
            p_vol = chain.puts["volume"].fillna(0).sum()
            total_calls += int(c_vol)
            total_puts  += int(p_vol)

        ratio = round(total_puts / total_calls, 4) if total_calls > 0 else None
        signal = _signal3(ratio is not None and ratio < 0.7,
                          ratio is not None and ratio > 1.0)
        return {
            "ratio":       ratio,
            "total_calls": total_calls,
            "total_puts":  total_puts,
            "expirations_used": list(used_exps),
            "signal":      signal,
            "note":        f"최근 {len(used_exps)}개 만기 합산",
        }
    except Exception as e:
        logger.warning("[stock] %s P/C 실패: %s", ticker, e)
        return {"ratio": None, "signal": "neutral", "note": f"옵션 데이터 오류: {e}"}


def _compute_high_low_block(rows):
    closes     = [r.close_price for r in rows if r.close_price is not None]
    highs      = [r.high_price  for r in rows if r.high_price  is not None]
    lows       = [r.low_price   for r in rows if r.low_price   is not None]
    if not closes:
        return None

    # 52주(252 거래일) 최고·최저
    n = min(252, len(closes))
    w52_high = max(highs[-n:])   if highs  else closes[-1]
    w52_low  = min(lows[-n:])    if lows   else closes[-1]
    close    = closes[-1]

    span = w52_high - w52_low
    position_pct = round((close - w52_low) / span * 100, 2) if span > 0 else 50.0
    pct_from_high = round((close - w52_high) / w52_high * 100, 2)
    pct_from_low  = round((close - w52_low)  / w52_low  * 100, 2) if w52_low else None

    signal = _signal3(position_pct >= 70, position_pct <= 30)

    return {
        "week52_high":  round(w52_high, 4),
        "week52_low":   round(w52_low, 4),
        "close":        round(close, 4),
        "position_pct": position_pct,
        "pct_from_high": pct_from_high,
        "pct_from_low":  pct_from_low,
        "signal": signal,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 10)  # 10분 캐시
def stock_indicators(request, symbol):
    """
    GET /invest/stock-indicators/<symbol>/
    개별 종목의 이동평균선 / 거래강도 / Put/Call Ratio / 52W 고저 지표 반환.
    DB에 최신 OHLCV 없으면 yfinance로 자동 수집 후 응답.
    """
    ticker = symbol.upper()

    # 1) DB 최신화 (필요 시 yfinance fetch)
    try:
        _ensure_stock_data(ticker)
    except Exception as e:
        logger.warning("[stock_indicators] %s ensure 실패: %s", ticker, e)

    # 2) DB에서 최근 400행 로드
    rows = list(
        StockDailyData.objects
        .filter(ticker=ticker)
        .order_by("date")
        .values_list("date", "open_price", "high_price",
                     "low_price", "close_price", "volume")
    )
    if not rows:
        return JsonResponse({"error": f"{ticker} 데이터 없음"}, status=404)

    # namedtuple-like 객체로 변환
    class _Row:
        __slots__ = ("date", "open_price", "high_price", "low_price", "close_price", "volume")
        def __init__(self, t):
            (self.date, self.open_price, self.high_price,
             self.low_price, self.close_price, self.volume) = t

    rows = [_Row(r) for r in rows]
    last = rows[-1]

    # 3) 지표 계산
    ma_block  = _compute_ma_block(rows)
    vol_block = _compute_volume_block(rows)
    hl_block  = _compute_high_low_block(rows)
    pc_block  = _compute_put_call(ticker)

    # 4) 종합 시그널
    sigs = {
        "ma":       ma_block["signal"]  if ma_block  else "neutral",
        "volume":   vol_block["signal"] if vol_block else "neutral",
        "put_call": pc_block["signal"]  if pc_block  else "neutral",
        "high_low": hl_block["signal"]  if hl_block  else "neutral",
    }
    counts = {"bullish": 0, "bearish": 0, "neutral": 0}
    for s in sigs.values():
        counts[s] += 1
    if counts["bullish"] > counts["bearish"]:
        overall_signal = "bullish"
    elif counts["bearish"] > counts["bullish"]:
        overall_signal = "bearish"
    else:
        overall_signal = "neutral"
    score = (counts["bullish"] - counts["bearish"]) * 25  # -100 ~ +100

    return JsonResponse({
        "ticker":    ticker,
        "last_date": str(last.date),
        "price": {
            "open":  last.open_price,
            "high":  last.high_price,
            "low":   last.low_price,
            "close": last.close_price,
        },
        "ma":       ma_block,
        "volume":   vol_block,
        "put_call": pc_block,
        "high_low": hl_block,
        "overall": {
            "signal": overall_signal,
            "score":  score,
            "signals": sigs,
            "counts":  counts,
        },
    })


# =====================================================================
# 기술사 기출문제 PDF 자동 파싱 — frontend StudyWriteFromPdf.jsx 호출용
# ---------------------------------------------------------------------
# POST /parse-exam-pdf/  (multipart/form-data, file=pdf)
# 응답: {
#   detected: { examname, examnumber, year },
#   pages: [{ page_index, stage, questions: [{qnumber, qtext}] }],
#   total_questions: N
# }
# 사전 설치: pip install pdfplumber
# =====================================================================
import re as _re
from rest_framework.parsers import MultiPartParser, FormParser

_HEADER_FOOTER_PATTERNS = [
    _re.compile(r"국가기술자격"),
    _re.compile(r"^기술사\s+제\d+회"),
    _re.compile(r"^분\s*수험\s*성"),
    _re.compile(r"^야\s*번호\s*명"),
    _re.compile(r"^건설"),
    _re.compile(r"^▶수험자"),
    _re.compile(r"^※"),
    _re.compile(r"^\d+\s*-\s*\d+$"),
    _re.compile(r"^[\"“]채점기준"),
]


def _clean_page_lines(text: str):
    out = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if any(p.search(line) for p in _HEADER_FOOTER_PATTERNS):
            continue
        out.append(line)
    return out


def _parse_questions_from_lines(lines):
    """[{qnumber, qtext}] 추출 — multi-line 본문 합침"""
    items = []
    cur = None
    pat = _re.compile(r"^(\d+)\.\s*(.+)$")
    for line in lines:
        m = pat.match(line)
        if m:
            if cur:
                items.append(cur)
            cur = {"qnumber": int(m.group(1)), "qtext": m.group(2).strip()}
        elif cur:
            cur["qtext"] += " " + line.strip()
    if cur:
        items.append(cur)
    # 공백 압축
    for it in items:
        it["qtext"] = _re.sub(r"\s+", " ", it["qtext"]).strip()
    return items


def _parse_meta(all_text: str):
    num_m = _re.search(r"기술사\s+제\s*(\d+)\s*회", all_text)
    sub_m = _re.search(
        r"(조경기술사|도시계획기술사|건축기술사|토목기술사|[가-힣]{2,8}기술사)",
        all_text,
    )
    # 연도 — "2024제132회" 같은 패턴 또는 별도 추정
    year_m = _re.search(r"(20\d{2})", all_text)
    return {
        "examname": sub_m.group(1) if sub_m else None,
        "examnumber": int(num_m.group(1)) if num_m else None,
        "year": int(year_m.group(1)) if year_m else None,
    }


# 교시 → ExamQsubject.examstage 매핑 (4교시는 빈 값)
_STAGE_LABELS = {1: "1st", 2: "2nd", 3: "3rd", 4: ""}


@api_view(['POST'])
@permission_classes([AllowAny])
def parse_exam_pdf(request):
    """기술사 기출문제 PDF 업로드 → 교시별 문제 파싱"""
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "file 파라미터가 필요합니다."}, status=400)

    try:
        import pdfplumber
    except ImportError:
        return JsonResponse(
            {"error": "백엔드에 pdfplumber 가 설치되지 않았습니다. `pip install pdfplumber` 실행 후 재시도하세요."},
            status=500,
        )

    # multipart 파일은 stream 위치가 끝에 있을 수 있어 BytesIO 로 명시적으로 감쌈
    try:
        f.seek(0)
    except Exception:
        pass
    raw = f.read()
    if not raw:
        return JsonResponse({"error": "업로드된 파일 내용이 비어있습니다."}, status=400)

    bio = io.BytesIO(raw)

    try:
        all_text = ""
        pages = []
        with pdfplumber.open(bio) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                all_text += page_text + "\n"
                cleaned = _clean_page_lines(page_text)
                qs = _parse_questions_from_lines(cleaned)
                pages.append({
                    "page_index": i,
                    "stage": i,                            # 교시 번호
                    "stage_label": _STAGE_LABELS.get(i, ""),
                    "questions": qs,
                })
        meta = _parse_meta(all_text)
        total = sum(len(p["questions"]) for p in pages)
        if total == 0 and not all_text.strip():
            return JsonResponse(
                {
                    "error": "PDF에서 텍스트를 추출하지 못했습니다. 스캔 이미지 PDF 이거나 폰트가 임베딩되지 않은 형식일 수 있습니다.",
                    "detected": meta,
                    "pages": pages,
                    "total_questions": 0,
                },
                status=200,  # 데이터 없음을 알리되 client 가 에러 핸들링하기 쉽게 200 + 빈 결과
            )
        return JsonResponse({
            "detected": meta,
            "pages": pages,
            "total_questions": total,
        })
    except Exception as e:
        logger.error("parse_exam_pdf 실패: %s", e, exc_info=True)
        return JsonResponse(
            {"error": f"PDF 파싱 실패: {str(e)}"},
            status=500,
        )

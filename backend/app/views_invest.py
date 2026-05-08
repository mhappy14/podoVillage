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
    {"key": "NETLIQ", "kind": "computed", "ref": "net_liquidity"},
    {"key": "SOFR", "kind": "fred", "ref": "SOFR"},
    {"key": "DTWEXBGS", "kind": "fred", "ref": "DTWEXBGS"},

    # 4. 경기
    {"key": "CPIAUCSL", "kind": "fred", "ref": "CPIAUCSL"},
    {"key": "ISM_MFG",  "kind": "unavailable"},
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


def update_indicators_for_quarter(quarter_date):
    """주어진 분기 첫날을 기준으로 (current, prev_q, prev_y) 3개 anchor 모두 fetch + 저장"""
    anchors = {
        "current": quarter_date,
        "prev_q":  _add_quarters(quarter_date, -1),
        "prev_y":  _add_years(quarter_date, -1),
    }
    written = 0
    skipped = 0
    for defn in INDICATOR_DEFS:
        for anchor_key, anchor_date in anchors.items():
            obs, source = _fetch_indicator_at(defn, anchor_date)
            obj, _ = IndicatorSnapshot.objects.update_or_create(
                indicator_key=defn["key"],
                quarter_anchor=anchor_key,
                quarter_date=quarter_date,
                defaults={
                    "observation_date": _parse_date(obs["date"]) if obs else None,
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
        DGS10: { current: {date, value, source}, prev_q: {...}, prev_y: {...} },
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
            "value": r.value,
            "source": r.source,
        }
    return JsonResponse({
        "quarter": qd.isoformat(),
        "indicators": indicators,
        "count": len(indicators),
        "fetched_at": max((r.fetched_at for r in rows), default=None).isoformat() if rows else None,
    })

from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.cache import cache_page
from datetime import datetime, timedelta
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
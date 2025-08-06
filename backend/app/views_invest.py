from django.http import JsonResponse
from datetime import datetime, timedelta
import yfinance as yf

def stock_history(request, symbol):
    try:
        end = datetime.today()
        start = end - timedelta(days=365)

        data = yf.download(symbol, start=start.strftime('%Y-%m-%d'), end=end.strftime('%Y-%m-%d'))
        data = data.reset_index()

        chart_data = {
            "labels": [d.strftime("%Y-%m-%d") for d in data['Date']],
            "prices": list(data['Close']),
        }
        return JsonResponse(chart_data)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

"""
Usage:
  python manage.py update_indicators                 # 현재 분기 + 직전 분기/년 anchor 갱신
  python manage.py update_indicators --quarter 2026-04-01

Cron 권장 (미국 동부 자정 기준):
  TZ=America/New_York
  0 0 * * * cd /path/to/auth/backend && /path/to/venv/bin/python manage.py update_indicators

또는 UTC 환경이면:
  0 5 * * * ...   # EST 자정 (winter, UTC-5)
  0 4 * * * ...   # EDT 자정 (summer, UTC-4)
※ TZ 환경변수 사용을 권장 — DST 자동 처리됨.
"""
import datetime as dt
from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_date

from app.views_invest import update_indicators_for_quarter, _quarter_start


class Command(BaseCommand):
    help = "FRED + yfinance + 합성 지표를 fetch 하여 IndicatorSnapshot 테이블에 저장"

    def add_arguments(self, parser):
        parser.add_argument(
            "--quarter",
            type=str,
            default=None,
            help="기준 분기 첫날 (YYYY-MM-DD). 기본: 오늘이 속한 분기 첫날",
        )

    def handle(self, *args, **opts):
        if opts.get("quarter"):
            qd = parse_date(opts["quarter"])
            if qd is None:
                self.stderr.write(self.style.ERROR("invalid --quarter (YYYY-MM-DD)"))
                return
        else:
            qd = _quarter_start(dt.date.today())

        self.stdout.write(f"▶ 갱신 시작 — 분기 기준일: {qd}")
        result = update_indicators_for_quarter(qd)
        self.stdout.write(self.style.SUCCESS(
            f"✅ 완료 — written={result['written']}, skipped={result['skipped']}"
        ))

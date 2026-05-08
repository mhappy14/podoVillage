# AUTH/backend/app/urls.py

from django.contrib import admin
from django.urls import path
from rest_framework.routers import DefaultRouter

# 기존 뷰셋 import
from .views import (
    fred_proxy,
    RegisterViewset, LoginViewset, UserViewset,
    CreateExamViewset, CreateExamnumberViewset, CreateExamQsubjectViewset,
    CreateQuestionViewset, CreateMainsubjectViewset, CreateDetailsubjectViewset,
    CreateExplanationViewset, CreateCommentViewset,
    AuthorViewSet, AgencyViewSet, PublicationViewSet, PaperViewSet,
    WikiPageViewSet,
    parse_exam_pdf,
)

# 투자지표 관련 뷰 import
from app.views_invest import (
    stock_history,
    fred_series,
    fear_greed_index,
    bitcoin_price,
    market_signals,
    ndx100_list,
    indicator_snapshots,
)

router = DefaultRouter()
# Auth
router.register('register', RegisterViewset, basename='register')
router.register('login',    LoginViewset,    basename='login')
router.register('users',    UserViewset,     basename='users')

# Exam / Question 등
router.register('exam',         CreateExamViewset,        basename='exam')
router.register('examnumber',   CreateExamnumberViewset,  basename='examnumber')
router.register('examqsubject', CreateExamQsubjectViewset,basename='examqsubject')
router.register('question',     CreateQuestionViewset,    basename='question')
router.register('mainsubject',  CreateMainsubjectViewset, basename='mainsubject')
router.register('detailsubject',CreateDetailsubjectViewset,basename='detailsubject')
router.register('explanation',  CreateExplanationViewset,  basename='explanation')
router.register('comment',      CreateCommentViewset,      basename='comment')

# Essay
router.register('author',      AuthorViewSet,      basename='author')
router.register('agency',      AgencyViewSet,      basename='agency')
router.register('publication', PublicationViewSet, basename='publication')
router.register('paper',       PaperViewSet,       basename='paper')

# Wiki
router.register('wiki', WikiPageViewSet, basename='wiki')

# router.urls 에 뷰셋 URL 이 모두 모여 있습니다.
urlpatterns = router.urls + [
    # 기존 FRED 프록시
    path('fred/', fred_proxy, name='fred-proxy'),

    # stock_history: 1년치 yfinance 종가
    # 기존에 쓰시던 /stock/<symbol>/ 도 살려두었습니다.
    path('stock/<str:symbol>/', stock_history, name='stock-history'),

    # 투자 지표용 별도 엔드포인트
    path('invest/stock-history/<str:symbol>/', stock_history, name='invest-stock-history'),
    path('invest/fred-series/',        fred_series,      name='invest-fred-series'),
    path('invest/fear-greed/',         fear_greed_index, name='invest-fear-greed'),
    path('invest/bitcoin/',            bitcoin_price,    name='invest-bitcoin'),
    path('invest/market-signals/',     market_signals,   name='invest-market-signals'),
    path('invest/ndx100/',             ndx100_list,      name='invest-ndx100'),
    path('invest/indicator-snapshots/', indicator_snapshots, name='invest-indicator-snapshots'),
    path('parse-exam-pdf/', parse_exam_pdf, name='parse-exam-pdf'),
]
from django.contrib import admin
from rest_framework.routers import DefaultRouter
from .views import * 
from django.urls import path


router = DefaultRouter()
router.register('register', RegisterViewset, basename='register')
router.register('login', LoginViewset, basename='login')
router.register('users', UserViewset, basename='users')

router.register('exam', CreateExamViewset, basename='exam')
router.register('examnumber', CreateExamnumberViewset, basename='examnumber')
router.register('question', CreateQuestionViewset, basename='question')
router.register('mainsubject', CreateMainsubjectViewset, basename='mainsubject')
router.register('detailsubject', CreateDetailsubjectViewset, basename='detailsubject')
router.register('explanation', CreateExplanationViewset, basename='explanation')
router.register('comment', CreateCommentViewset, basename='comment')

router.register('producer', ProducerViewSet, basename='producer')
router.register('agency', AgencyViewSet, basename='agency')
router.register('publication', PublicationViewSet, basename='publication')
router.register('essay', EssayViewSet, basename='essay')

urlpatterns = router.urls
urlpatterns = router.urls + [
    path('api/fred/', fred_proxy, name='fred_proxy')
]

# 1 시험명Exam(시험명examname)
# 2 시험회차Examnumber(회차examnumber - 연도year - 월month)
# 3 문제Question(번호questionnumber1 - 번호questionnumber2 - 문제questiontext - 좋아요 - 북마크 - 날짜)
# 4 주요과목Mainsubject(주요과목번호mainnumber - 주요과목mainname)
# 5 세부과목Detailsubject(세부과목번호detailnumber - 세부과목detailtitle)
# 6 해설Explanation(글쓴이 - 좋아요 - 북마크 - 날짜)
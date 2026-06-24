from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action, api_view, permission_classes
from knox.models import AuthToken
from app.models import *
from app.serializers import *
from app.permissions import *
from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.urls import reverse
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
import requests
from app.views_invest import stock_history
from urllib.parse import unquote
import unicodedata
from django.http import JsonResponse

NDX100 = [
    {"ticker": "AAPL", "name": "Apple"},
    {"ticker": "MSFT", "name": "Microsoft"},
    # ...
]

def ndx100_list(request):
    quarter = request.GET.get("quarter")  # YYYY-MM-DD
    # 분기별로 다른 구성을 줄 거면 quarter 기준 필터링
    return JsonResponse({"items": NDX100, "quarter": quarter})


def _normalize_title(raw: str) -> str:
    # 안전 정규화: 퍼센트 디코드, 공백/슬래시 정리, 유니코드 정규화
    t = unquote(raw or '').strip()
    t = t.rstrip('/')            # 끝 슬래시 제거 (프론트와 규칙 일치)
    t = unicodedata.normalize('NFKC', t)
    return t

@api_view(['GET'])
@permission_classes([AllowAny])
def fred_proxy(request):
    base_url = "https://api.stlouisfed.org/fred/series/observations"
    params = request.GET.dict()  # 프론트엔드에서 받은 쿼리 파라미터

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        return Response(response.json())
    except requests.RequestException as e:
        return Response({"error": str(e)}, status=500)

def activate_user(request, uid, token):
	try:
		uid = urlsafe_base64_decode(uid).decode()
		user = CustomUser.objects.get(pk=uid)
	except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
		return Response({"error": "유효하지 않은 링크입니다."}, status=status.HTTP_400_BAD_REQUEST)

	if default_token_generator.check_token(user, token):
		user.is_active = True
		user.save()
		return Response({"message": "계정이 활성화되었습니다."}, status=status.HTTP_200_OK)
	return Response({"error": "토큰이 유효하지 않습니다."}, status=status.HTTP_400_BAD_REQUEST)

def generate_email_verification_token(user):
	uid = urlsafe_base64_encode(force_bytes(user.pk))  # User의 PK를 인코딩
	token = default_token_generator.make_token(user)  # Token 생성
	return uid, token

def send_verification_email(user, request):
	uid, token = generate_email_verification_token(user)
	activation_url = f"{request.scheme}://{request.get_host()}/api/activate/{uid}/{token}/"
	subject = "이메일 인증을 완료해주세요"
	message = f"아래 링크를 클릭하여 이메일 인증을 완료해주세요:\n\n{activation_url}"
	send_mail(subject, message, "noreply@example.com", [user.email])

class LoginViewset(viewsets.ViewSet):
	permission_classes = [permissions.AllowAny]
	serializer_class = LoginSerializer

	def create(self, request): 
		serializer = self.serializer_class(data=request.data)
		if serializer.is_valid():
			user = serializer.validated_data['user']
			_, token = AuthToken.objects.create(user)
			return Response({
				"user": UserSerializer(user).data,
				"token": token
			}, status=status.HTTP_200_OK)
		else:
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RegisterViewset(viewsets.ViewSet):
	permission_classes = [permissions.AllowAny]
	serializer_class = RegisterSerializer

	def create(self, request):
		serializer = self.serializer_class(data=request.data)
		if serializer.is_valid():
			user = serializer.save()
			user.is_active = False
			user.save()
			send_verification_email(user, request)  # 이메일 전송
			return Response({"message": "회원가입 성공. 이메일을 확인해주세요."}, status=status.HTTP_201_CREATED)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
				
class UserViewset(viewsets.ModelViewSet):
	queryset = CustomUser.objects.all()
	serializer_class = UserSerializer
	permission_classes = [IsAuthenticated]

	def get_serializer_class(self):
		if self.action in ['create', 'register']:
			return RegisterSerializer
		return UserSerializer

	def get_queryset(self):
		user = self.request.user
		if user.is_staff:
			return CustomUser.objects.all()
		return CustomUser.objects.filter(pk=user.pk)

	@action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
	def me(self, request):
			serializer = self.get_serializer(request.user)
			return Response(serializer.data)

	@action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
	def deactivate(self, request):
			user = request.user
			serializer = DeactivateAccountSerializer(user)
			serializer.update(user, {'is_active': False})  # is_active 필드를 False로 설정
			return Response({"message": "회원탈퇴가 완료되었습니다."})

# 1 시험명Exam(시험명examname)
class CreateExamViewset(viewsets.ModelViewSet):
	queryset = Exam.objects.all().prefetch_related("examnumber_set__question_set__options", "examnumber_set__question_set__examqsubject", "examnumber_set__question_set__explanation_set", "examnumber_set__explanation_set__nickname", "examnumber_set__explanation_set__comments_ex__nickname", "examnumber_set__explanation_set__comments_ex__like", "examnumber_set__explanation_set__mainsubject", "examnumber_set__explanation_set__detailsubject", "examnumber_set__explanation_set__like", "examnumber_set__explanation_set__bookmark")   #ModelViewSet은 curd를 제공하므로, 어떤 데이터 모델을 crud할 것인지 필요함 
	serializer_class = ExamSerializer
	permission_classes = [permissions.AllowAny]

	def perform_create(self, serializer):
		serializer.save()

# 2 시험회차Examnumber(회차examnumber - 연도year)
class CreateExamnumberViewset(viewsets.ModelViewSet):
	queryset = Examnumber.objects.all().select_related("exam").prefetch_related("question_set__options", "question_set__examqsubject", "question_set__explanation_set", "explanation_set__nickname", "explanation_set__comments_ex__nickname", "explanation_set__comments_ex__like", "explanation_set__mainsubject", "explanation_set__detailsubject", "explanation_set__like", "explanation_set__bookmark")
	serializer_class = ExamnumberSerializer
	permission_classes = [permissions.AllowAny]
	# ✨ /examnumber/?exam=<id> 로 특정 시험의 회차만 가져올 수 있게 함
	#    (StudyView 등이 전체 회차 + 중첩 questions 까지 다 받아 timeout 나는 문제 방지)
	filter_backends = [DjangoFilterBackend]
	filterset_fields = ['exam', 'year', 'examnumber']

	def perform_create(self, serializer):
		serializer.save()

	@action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
	def check_examnumber(self, request):
			exam_id = request.query_params.get('exam')
			examnumber = request.query_params.get('examnumber')

			if not exam_id or not examnumber:
					return Response({"error": "exam and examnumber are required parameters."}, status=400)

			exists = Examnumber.objects.filter(exam_id=exam_id, examnumber=examnumber).exists()
			return Response({"exists": exists}, status=200)

class CreateExamQsubjectViewset(viewsets.ModelViewSet):
    queryset = ExamQsubject.objects.all().select_related("exam")
    serializer_class = ExamQsubjectSerializer
    permission_classes = [permissions.AllowAny]
    # ✨ /examqsubject/?exam=<id>&examnumber=<id> 필터링 지원
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['exam', 'examnumber', 'esn']

    def perform_create(self, serializer):
        serializer.save()

# 3 문제Question(번호questionnumber1 - 번호questionnumber2 - 문제questiontext - 좋아요 - 북마크 - 날짜)
class CreateQuestionViewset(viewsets.ModelViewSet):
    queryset = Question.objects.all().select_related(
        "exam", "examnumber", "examqsubject"
    ).prefetch_related("options")
    serializer_class = QuestionSerializer
    permission_classes = [permissions.AllowAny]
    # ✨ 프론트에서 examnumber·exam·examqsubject 등으로 필터링할 수 있도록
    #    (PDF 일괄 등록 시 기존 Question 중복 확인용)
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['exam', 'examnumber', 'examqsubject', 'qnumber']

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def check_question(self, request):
        """
        중복 검사용 엔드포인트:
        - exam: 시험 ID
        - examnumber: 회차 ID
        - examqsubject: 과목 ID
        - qnumber: 문항번호
        """
        exam_id = request.query_params.get('exam')
        examnumber_id = request.query_params.get('examnumber')
        examqsubject_id = request.query_params.get('examqsubject')
        qnumber = request.query_params.get('qnumber')

        if not all([exam_id, examnumber_id, examqsubject_id, qnumber]):
            return Response({"error": "exam, examnumber, examqsubject, qnumber are required."}, status=400)

        exists = Question.objects.filter(
            exam_id=exam_id,
            examnumber_id=examnumber_id,
            examqsubject_id=examqsubject_id,
            qnumber=qnumber
        ).exists()

        return Response({"exists": exists}, status=200)
		
# 4 주요과목Mainsubject(주요과목번호mainnumber - 주요과목mainname)
class CreateMainsubjectViewset(viewsets.ModelViewSet):
	queryset = Mainsubject.objects.all()
	serializer_class = MainsubjectSerializer
	permission_classes = [permissions.AllowAny]

	def perform_create(self, serializer):
		serializer.save()

	# mainnumber 중복 확인을 위한 커스텀 엔드포인트
	@action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
	def check_mainnumber(self, request):
			exam_id = request.query_params.get('exam')
			mainnumber = request.query_params.get('mainnumber')

			if not exam_id or not mainnumber:
					return Response({"error": "exam and mainnumber are required parameters."}, status=400)

			exists = Mainsubject.objects.filter(mainnumber=mainnumber).exists()
			if exists:
					return Response({"exists": True}, status=200)
			return Response({"exists": False}, status=200)
		
# 5 세부과목Detailsubject(세부과목번호detailnumber - 세부과목detailtitle)
class CreateDetailsubjectViewset(viewsets.ModelViewSet):
	queryset = Detailsubject.objects.all()
	serializer_class = DetailsubjectSerializer
	permission_classes = [permissions.AllowAny]

	def perform_create(self, serializer):
		serializer.save()

	# detailnumber 중복 확인을 위한 커스텀 엔드포인트
	@action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
	def check_detailnumber(self, request):
			mainslug_id = request.query_params.get('mainslug')
			detailnumber = request.query_params.get('detailnumber')

			if not mainslug_id or not detailnumber:
					return Response({"error": "mainslug and detailnumber are required parameters."}, status=400)

			exists = Detailsubject.objects.filter(mainslug_id=mainslug_id, detailnumber=detailnumber).exists()
			if exists:
					return Response({"exists": True}, status=200)
			return Response({"exists": False}, status=200)

# 6 해설Explanation(글쓴이 - 좋아요 - 북마크 - 날짜)
class CreateExplanationViewset(viewsets.ModelViewSet):
	queryset = Explanation.objects.all().order_by('-created_at')  # 최신 순으로 정렬
	serializer_class = ExplanationSerializer
	# ✨ /explanation/?examnumber=<id>&question=<id>&exam=<id> 필터링 지원
	filter_backends = [DjangoFilterBackend]
	filterset_fields = ['exam', 'examnumber', 'question']

	# 조회는 비로그인 허용, 작성/수정/삭제는 로그인 필요
	def get_permissions(self):
		if self.action in ('list', 'retrieve'):
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated()]

	def perform_create(self, serializer):
		mainsubject_data = self.request.data.get('mainsubject', []) or []
		detailsubject_data = self.request.data.get('detailsubject', []) or []
		# AnonymousUser 는 FK에 저장 불가 — 명시적으로 None 처리
		user = self.request.user if self.request.user.is_authenticated else None
		explanation = serializer.save(nickname=user)
		explanation.mainsubject.set(mainsubject_data)
		explanation.detailsubject.set(detailsubject_data)

	def perform_update(self, serializer):
		mainsubject_data = self.request.data.get('mainsubject', [])
		detailsubject_data = self.request.data.get('detailsubject', [])
		explanation = serializer.save()
		explanation.mainsubject.set(mainsubject_data)
		explanation.detailsubject.set(detailsubject_data)

	@action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
	def update_explanation(self, request, pk=None):
			explanation = self.get_object()
			serializer = self.get_serializer(explanation, data=request.data, partial=True)
			if serializer.is_valid():
					serializer.save()
					return Response({'message': '설명이 성공적으로 수정되었습니다.'}, status=status.HTTP_200_OK)
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	@action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
	def like(self, request, pk=None):
			explanation = self.get_object()
			explanation.like.add(request.user)  # 현재 사용자를 좋아요 목록에 추가
			return Response({'message': '좋아요가 추가되었습니다.', 'like_count': explanation.like.count()})

	@action(detail=True, methods=['delete'], permission_classes=[permissions.IsAuthenticated])
	def unlike(self, request, pk=None):
			explanation = self.get_object()
			explanation.like.remove(request.user)  # 현재 사용자를 좋아요 목록에서 제거
			return Response({'message': '좋아요가 취소되었습니다.', 'like_count': explanation.like.count()})
	
	@action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
	def bookmark(self, request, pk=None):
			explanation = self.get_object()
			explanation.bookmark.add(request.user)
			return Response({'message': '북마크가 추가되었습니다.', 'bookmark_count': explanation.bookmark.count()})

	@action(detail=True, methods=['delete'], permission_classes=[permissions.IsAuthenticated])
	def unbookmark(self, request, pk=None):
			explanation = self.get_object()
			explanation.bookmark.remove(request.user)
			return Response({'message': '북마크가 취소되었습니다.', 'bookmark_count': explanation.bookmark.count()})


class CreateCommentViewset(viewsets.ModelViewSet):
    queryset = Comment.objects.all().order_by('-created_at')
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny]  
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['explanation']  # explanation 필드를 기준으로 필터링 허용

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def like_toggle(self, request, pk=None):
        comment = self.get_object()
        user = request.user

        if comment.like.filter(id=user.id).exists():
            comment.like.remove(user)
            return Response({"message": "댓글 좋아요가 취소되었습니다."})
        else:
            comment.like.add(user)
            return Response({"message": "댓글 좋아요를 눌렀습니다."})

    def perform_create(self, serializer):
        serializer.save(nickname=self.request.user)

#######################에세이#######################

class AuthorViewSet(viewsets.ModelViewSet):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer

class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all()
    serializer_class = AgencySerializer

class PublicationViewSet(viewsets.ModelViewSet):
    queryset = Publication.objects.all()
    serializer_class = PublicationSerializer

class PaperViewSet(viewsets.ModelViewSet):
    queryset = Paper.objects.all()
    serializer_class = PaperSerializer

#######################위키#######################

class WikiPageViewSet(viewsets.ModelViewSet):
    queryset = WikiPage.objects.all().order_by('-updated_at')
    serializer_class = WikiPageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'
    lookup_url_kwarg = 'slug'

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save(nickname=self.request.user)
        WikiVersion.objects.create(page=instance, content=instance.content, nickname=self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        instance = self.get_object()
        new_content = self.request.data.get("content", instance.content)
        content_changed = (instance.content != new_content)
        instance = serializer.save()
        if content_changed:
            WikiVersion.objects.create(page=instance, content=instance.content, nickname=self.request.user)

    @action(detail=True, methods=['get'])
    def versions(self, request, slug=None, *args, **kwargs):
        page_obj = self.get_object()
        qs = page_obj.versions.all()
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = WikiVersionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = WikiVersionSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='latest-version')
    def latest_version(self, request, slug=None, *args, **kwargs):
        page_obj = self.get_object()
        latest = page_obj.versions.first()
        if not latest:
            return Response({"detail": "최신 버전이 없습니다."}, status=404)
        serializer = WikiVersionSerializer(latest)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'by-title/(?P<title>.+)')
    def by_title(self, request, title=None):
        page = get_object_or_404(WikiPage, title=title)
        serializer = self.get_serializer(page)
        return Response(serializer.data)
		
    @action(detail=False, methods=['get'], url_path=r't/(?P<title>.+)')
    def by_title_short(self, request, title=None):
        page = get_object_or_404(WikiPage, title=title)
        serializer = self.get_serializer(page)
        return Response(serializer.data)

    # ✅ 최근 문서 10개
    @action(detail=False, methods=['get'], url_path='recent')
    def recent(self, request, *args, **kwargs):
        qs = WikiPage.objects.order_by('-updated_at')[:10]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='search')
    def search(self, request, *args, **kwargs):
        q = request.query_params.get('q', '').strip()
        if not q: return Response([], status=200)
        qs = WikiPage.objects.filter(Q(title__icontains=q)).order_by('-updated_at')[:10]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'by-title/(?P<title>.+)')
    def by_title_path(self, request, title=None):
        norm = _normalize_title(title)
        page = get_object_or_404(WikiPage, title=norm)
        return Response(self.get_serializer(page).data)

		# 2) 쿼리스트링 버전 (title=? 로 받기)
    @action(detail=False, methods=['get'], url_path='by-title')
    def by_title_query(self, request):
        raw = request.query_params.get('title', '')
        if not raw:
        		return Response({"detail": "title 필요"}, status=status.HTTP_400_BAD_REQUEST)
        norm = _normalize_title(raw)
        page = get_object_or_404(WikiPage, title=norm)
        return Response(self.get_serializer(page).data)

# =====================================================================
# PDF 기반 기술사 기출문제 파싱
# ---------------------------------------------------------------------
# 입력: multipart/form-data 로 업로드된 PDF 파일
# 출력: {
#   detected: {
#     examname: '조경기술사',
#     examnumber: 132,
#     year: 2024,
#   },
#   pages: [
#     { stage: 1, questions: [{ qnumber: 1, qtext: '...' }, ...] },
#     ...
#   ]
# }
# 파싱 후 즉시 저장하지는 않고 프론트가 사용자에게 미리보기 → 확인 → 저장 호출.
# =====================================================================
import re as _re
try:
    from pypdf import PdfReader as _PdfReader  # pypdf 가 설치되어 있어야 함
except Exception:
    _PdfReader = None


def _detect_exam_meta(full_text: str):
    """첫 페이지 헤더에서 시험명/회차/시험시간 추출"""
    meta = {}
    # 회차: "기술사 제132회"
    m = _re.search(r'기술사\s*제\s*(\d+)\s*회', full_text)
    if m:
        meta['examnumber'] = int(m.group(1))
    # 종목명: "조경기술사", "도시계획기술사" 등
    m = _re.search(r'(\S*기술사)', full_text)
    if m:
        meta['examname'] = m.group(1).strip()
    # 시험시간: "시험시간: 100분"
    m = _re.search(r'시험시간\s*[:：]?\s*(\d+)', full_text)
    if m:
        meta['minutes'] = int(m.group(1))
    return meta


def _parse_questions_in_page(page_text: str):
    """
    페이지 텍스트에서 문제 리스트 추출.
    패턴: 줄 시작 또는 공백 후 "N." (N=1~99) 다음에 본문이 이어지고
          다음 "M." 까지가 한 문제.
    """
    # 헤더/푸터 정리: 페이지 번호 "1 - 1", "수험번호" 라인 등 제거
    cleaned = []
    for line in page_text.split('\n'):
        s = line.strip()
        if not s:
            continue
        # 헤더/푸터 패턴
        if _re.match(r'^[\d]+\s*-\s*[\d]+$', s):  # "1 - 1" 페이지 번호
            continue
        if '수험번호' in s or '응시 종목' in s or '인쇄 상태' in s:
            continue
        if s.startswith('"채점기준') or s.startswith('“채점기준'):
            continue
        if s.startswith('국가기술자격') or '시험문제' in s and '기술사' in s:
            continue
        if s.startswith('▶') or s.startswith('※'):
            # ※ 안내문은 한 줄짜리이므로 그냥 스킵
            continue
        if _re.match(r'^[\d]교시$', s):  # "1교시"
            continue
        cleaned.append(s)

    body = ' '.join(cleaned)
    # 문제 분리: "N." (1~99) 으로 시작하는 부분
    parts = _re.split(r'(?<!\d)(\d{1,2})\.\s+', body)
    # parts 는 [pre, num, text, num, text, ...] 형태
    questions = []
    for i in range(1, len(parts), 2):
        try:
            qnum = int(parts[i])
        except ValueError:
            continue
        qtext = parts[i + 1] if i + 1 < len(parts) else ''
        qtext = qtext.strip().rstrip('.')
        if qtext and qnum > 0:
            questions.append({"qnumber": qnum, "qtext": qtext})
    return questions


def _detect_stage(page_text: str, page_idx: int):
    """페이지 내 'N교시' 또는 페이지 인덱스 기반으로 교시 결정"""
    m = _re.search(r'(\d+)\s*교시', page_text)
    if m:
        return int(m.group(1))
    # 폴백: 페이지 순서 (0-based → 1교시부터)
    return page_idx + 1


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def parse_exam_pdf(request):
    """
    POST /parse-exam-pdf/  (multipart/form-data, file=...)
    """
    if _PdfReader is None:
        return JsonResponse({
            "error": "pypdf 미설치 — 백엔드에 'pip install pypdf' 가 필요합니다.",
        }, status=500)

    f = request.FILES.get('file')
    if not f:
        return JsonResponse({"error": "PDF 파일이 첨부되지 않았습니다."}, status=400)

    try:
        reader = _PdfReader(f)
    except Exception as e:
        return JsonResponse({"error": f"PDF 열기 실패: {e}"}, status=400)

    pages = []
    full_text_parts = []
    for idx, page in enumerate(reader.pages):
        try:
            ptext = page.extract_text() or ''
        except Exception:
            ptext = ''
        full_text_parts.append(ptext)
        stage = _detect_stage(ptext, idx)
        questions = _parse_questions_in_page(ptext)
        pages.append({
            "page_index": idx,
            "stage": stage,
            "questions": questions,
        })

    full_text = '\n'.join(full_text_parts)
    meta = _detect_exam_meta(full_text)
    # 파일명에서 연도 추출 시도
    fname = getattr(f, 'name', '')
    m_year = _re.search(r'(20\d{2})', fname)
    if m_year:
        meta['year'] = int(m_year.group(1))

    return JsonResponse({
        "detected": meta,
        "pages": pages,
        "total_questions": sum(len(p["questions"]) for p in pages),
    })


# =====================================================================
# UserFormulaViewset — 사용자 정의 공식 CRUD (1단계)
# ---------------------------------------------------------------------
# 인증된 사용자는 자기 공식만 보고 만들고 수정/삭제할 수 있다.
# 2단계에서 사용자당 최대 5개 제한을 추가할 예정 (현재는 무제한).
# =====================================================================

class UserFormulaViewset(viewsets.ModelViewSet):
    serializer_class = UserFormulaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return UserFormula.objects.none()
        return UserFormula.objects.filter(user=user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # 소유자만 수정 가능 (get_queryset 으로 이미 필터링되지만 한 번 더 가드)
        from rest_framework.exceptions import PermissionDenied
        if serializer.instance.user_id != self.request.user.id:
            raise PermissionDenied("본인 공식만 수정할 수 있습니다.")
        serializer.save()


# =====================================================================
# ProjectSite — 필지(대상지) 기반 성과물 (조경·도시·건축 학생 성과물)
# ---------------------------------------------------------------------
# 업로드(생성/수정/삭제): 로그인 사용자, 본인 글만 수정/삭제
# 열람(목록/상세/지도): 누구나(비로그인 포함)
# =====================================================================
import json as _json
import math as _math
from django.conf import settings as _settings
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import PermissionDenied


def _ring_centroid_area(ring):
    """GeoJSON 링([[lng,lat],...]) 의 centroid(lng,lat)와 부호있는 면적(deg^2)."""
    n = len(ring)
    if n < 3:
        xs = [p[0] for p in ring] or [0]
        ys = [p[1] for p in ring] or [0]
        return sum(xs) / len(xs), sum(ys) / len(ys), 0.0
    a = cx = cy = 0.0
    for i in range(n - 1):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if a == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys), 0.0
    a *= 0.5
    return cx / (6 * a), cy / (6 * a), a


def _polygon_area_m2(rings, lat):
    """단일 폴리곤(외곽+홀)의 근사 면적(㎡). 위도 기준 등거리 투영 근사."""
    mlat = 111320.0
    mlng = 111320.0 * _math.cos(_math.radians(lat))
    area = 0.0
    for idx, ring in enumerate(rings):
        _, _, a = _ring_centroid_area(ring)
        a_m = abs(a) * mlat * mlng
        area += a_m if idx == 0 else -a_m
    return max(area, 0.0)


def _geom_center_area(geom):
    """GeoJSON geometry → (center_lat, center_lng, area_sqm). 실패 시 (None,None,None)."""
    if not geom or not isinstance(geom, dict):
        return (None, None, None)
    t = geom.get('type')
    coords = geom.get('coordinates')
    if not coords:
        return (None, None, None)
    if t == 'Polygon':
        polys = [coords]
    elif t == 'MultiPolygon':
        polys = coords
    else:
        return (None, None, None)
    total = cxs = cys = total_m2 = 0.0
    for poly in polys:
        if not poly or not poly[0]:
            continue
        ext = poly[0]
        cx, cy, a = _ring_centroid_area(ext)
        w = abs(a)
        total += w
        cxs += cx * w
        cys += cy * w
        total_m2 += _polygon_area_m2(poly, cy)
    if total == 0:
        try:
            first = polys[0][0][0]
            return (first[1], first[0], None)
        except Exception:
            return (None, None, None)
    return (cys / total, cxs / total, round(total_m2, 1))


class IsSiteOwnerOrReadOnly(permissions.BasePermission):
    """안전 메서드는 누구나, 쓰기는 로그인+본인(또는 staff)만."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user and request.user.is_staff:
            return True
        return obj.nickname_id == getattr(request.user, 'id', None)


def _detect_kind(filename):
    name = (filename or '').lower()
    if name.endswith('.pdf'):
        return 'pdf'
    if name.rsplit('.', 1)[-1] in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'):
        return 'image'
    return 'file'


class ProjectSiteViewSet(viewsets.ModelViewSet):
    queryset = ProjectSite.objects.all().select_related('nickname').prefetch_related('files')
    serializer_class = ProjectSiteSerializer
    permission_classes = [IsSiteOwnerOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'site_type', 'status']
    search_fields = ['title', 'summary', 'description', 'jibun', 'address']
    ordering_fields = ['created_at', 'updated_at', 'title']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectSiteListSerializer
        return ProjectSiteSerializer

    def get_queryset(self):
        qs = ProjectSite.objects.all().select_related('nickname').prefetch_related('files')
        # 비공개(draft)는 본인에게만 노출
        user = self.request.user
        if user and user.is_authenticated and not user.is_staff:
            qs = qs.filter(Q(status='published') | Q(nickname=user))
        elif not (user and user.is_authenticated):
            qs = qs.filter(status='published')
        return qs

    def _parse_geometry(self, raw):
        if raw is None or raw == '':
            return None
        if isinstance(raw, (dict, list)):
            return raw
        try:
            return _json.loads(raw)
        except (ValueError, TypeError):
            return None

    def _save_files(self, site, request, start_order=0):
        files = request.FILES.getlist('files')
        captions = request.data.getlist('captions') if hasattr(request.data, 'getlist') else []
        for i, f in enumerate(files):
            SiteFile.objects.create(
                site=site,
                file=f,
                kind=_detect_kind(getattr(f, 'name', '')),
                caption=captions[i] if i < len(captions) else '',
                order=start_order + i,
            )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = {k: v for k, v in request.data.items() if k not in ('geometry', 'files', 'captions')}
        serializer = ProjectSiteSerializer(data=data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)

        geometry = self._parse_geometry(request.data.get('geometry'))
        lat, lng, area = _geom_center_area(geometry)
        save_kwargs = {'nickname': request.user, 'geometry': geometry}
        # 프론트가 center/area 를 직접 보냈으면 우선, 없으면 계산값 사용
        if request.data.get('center_lat') in (None, ''):
            save_kwargs['center_lat'] = lat
        if request.data.get('center_lng') in (None, ''):
            save_kwargs['center_lng'] = lng
        if request.data.get('area_sqm') in (None, '') and area is not None:
            save_kwargs['area_sqm'] = area

        site = serializer.save(**save_kwargs)
        self._save_files(site, request)
        out = ProjectSiteSerializer(site, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = {k: v for k, v in request.data.items() if k not in ('geometry', 'files', 'captions')}
        serializer = ProjectSiteSerializer(
            instance, data=data, partial=partial, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        save_kwargs = {}
        if 'geometry' in request.data:
            geometry = self._parse_geometry(request.data.get('geometry'))
            lat, lng, area = _geom_center_area(geometry)
            save_kwargs.update(geometry=geometry, center_lat=lat, center_lng=lng)
            if area is not None:
                save_kwargs['area_sqm'] = area
        site = serializer.save(**save_kwargs)
        # 새 파일이 함께 오면 추가
        if request.FILES.getlist('files'):
            existing = site.files.count()
            self._save_files(site, request, start_order=existing)
        out = ProjectSiteSerializer(site, context=self.get_serializer_context())
        return Response(out.data)

    def perform_create(self, serializer):
        serializer.save(nickname=self.request.user)

    @action(detail=True, methods=['post'], url_path='upload',
            parser_classes=[MultiPartParser, FormParser])
    def upload(self, request, pk=None):
        site = self.get_object()
        if not (request.user.is_staff or site.nickname_id == request.user.id):
            raise PermissionDenied("본인 성과물에만 파일을 추가할 수 있습니다.")
        existing = site.files.count()
        self._save_files(site, request, start_order=existing)
        out = ProjectSiteSerializer(site, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'files/(?P<file_id>[0-9]+)')
    def delete_file(self, request, pk=None, file_id=None):
        site = self.get_object()
        if not (request.user.is_staff or site.nickname_id == request.user.id):
            raise PermissionDenied("본인 성과물의 파일만 삭제할 수 있습니다.")
        sf = get_object_or_404(SiteFile, pk=file_id, site=site)
        sf.file.delete(save=False)
        sf.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        site = self.get_object()
        user = request.user
        if site.like.filter(id=user.id).exists():
            site.like.remove(user)
            liked = False
        else:
            site.like.add(user)
            liked = True
        return Response({'is_liked': liked, 'like_count': site.like.count()})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def mine(self, request):
        qs = ProjectSite.objects.filter(nickname=request.user).prefetch_related('files')
        page = self.paginate_queryset(qs)
        ser = ProjectSiteListSerializer(
            page if page is not None else qs, many=True,
            context=self.get_serializer_context(),
        )
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=False, methods=['get'])
    def geojson(self, request):
        """지도 오버레이용 FeatureCollection."""
        qs = self.filter_queryset(self.get_queryset())
        features = []
        for s in qs:
            if not s.geometry:
                continue
            features.append({
                'type': 'Feature',
                'geometry': s.geometry,
                'properties': {
                    'id': s.id,
                    'title': s.title,
                    'category': s.category,
                    'category_label': s.get_category_display(),
                    'site_type': s.site_type,
                    'site_type_label': s.get_site_type_display(),
                    'center_lat': s.center_lat,
                    'center_lng': s.center_lng,
                },
            })
        return Response({'type': 'FeatureCollection', 'features': features})


@api_view(['GET'])
@permission_classes([AllowAny])
def vworld_parcel(request):
    """
    좌표(lat,lng)가 포함된 연속지적 필지(LP_PA_CBND_BUBUN)를 VWorld Data API 로
    조회해 PNU·지번·geometry 를 반환한다. (서버 프록시 — 도메인/CORS 회피)
    """
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return Response({'error': 'lat/lng 파라미터가 필요합니다.'}, status=400)

    key = getattr(_settings, 'VWORLD_KEY', '')
    if not key:
        return Response(
            {'found': False, 'error': 'VWORLD_KEY 가 설정되지 않았습니다. (서버 환경변수 확인)'},
            status=500,
        )
    params = {
        'service': 'data',
        'request': 'GetFeature',
        'data': 'LP_PA_CBND_BUBUN',
        'key': key,
        'domain': request.GET.get('domain', 'http://localhost:5173'),
        'geomFilter': f'POINT({lng} {lat})',
        'geometry': 'true',
        'attribute': 'true',
        'crs': 'EPSG:4326',
        'format': 'json',
        'size': '1',
    }
    try:
        r = requests.get('https://api.vworld.kr/req/data', params=params, timeout=10)
        r.raise_for_status()
        payload = r.json()
    except (requests.RequestException, ValueError) as e:
        return Response({'found': False, 'error': f'VWorld 요청 실패: {e}'}, status=502)

    # VWorld 응답 상태 확인: 인증/도메인/권한 오류를 '필지 없음' 으로 가리지 않는다.
    resp = payload.get('response', {}) if isinstance(payload, dict) else {}
    status_val = (resp.get('status') or '').upper()

    if status_val == 'ERROR':
        err = resp.get('error', {}) or {}
        code = err.get('code') or err.get('level') or ''
        text = err.get('text') or err.get('message') or '알 수 없는 오류'
        msg = f'VWorld 인증/요청 오류({code}): {text}. 키의 Data(데이터) API 사용권한과 등록 도메인을 확인하세요.'
        return Response({'found': False, 'error': msg, 'vworld_status': status_val}, status=502)

    if status_val == 'NOT_FOUND':
        return Response({'found': False, 'detail': '해당 위치의 필지를 찾지 못했습니다.'})

    try:
        feature = resp['result']['featureCollection']['features'][0]
        props = feature.get('properties', {})
        geometry = feature.get('geometry')
        lat_c, lng_c, area = _geom_center_area(geometry)
        return Response({
            'found': True,
            'pnu': props.get('pnu', ''),
            'jibun': props.get('jibun', ''),
            'addr': props.get('addr', '') or props.get('ag_geom', ''),
            'geometry': geometry,
            'center_lat': lat_c,
            'center_lng': lng_c,
            'area_sqm': area,
            'properties': props,
        })
    except (KeyError, IndexError, TypeError):
        return Response({'found': False, 'detail': '해당 위치의 필지를 찾지 못했습니다.'})

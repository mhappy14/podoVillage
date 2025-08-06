from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action, api_view, permission_classes
from knox.models import AuthToken
from app.models import *
from app.serializers import *
from app.permissions import *
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
	queryset = Exam.objects.all()   #ModelViewSet은 curd를 제공하므로, 어떤 데이터 모델을 crud할 것인지 필요함 
	serializer_class = ExamSerializer
	permission_classes = [permissions.AllowAny]

	def perform_create(self, serializer):
		serializer.save()

# 2 시험회차Examnumber(회차examnumber - 연도year)
class CreateExamnumberViewset(viewsets.ModelViewSet):
	queryset = Examnumber.objects.all()
	serializer_class = ExamnumberSerializer
	permission_classes = [permissions.AllowAny]

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

# 3 문제Question(번호questionnumber1 - 번호questionnumber2 - 문제questiontext - 좋아요 - 북마크 - 날짜)
class CreateQuestionViewset(viewsets.ModelViewSet):
	queryset = Question.objects.all()
	serializer_class = QuestionSerializer
	permission_classes = [permissions.AllowAny]

	def perform_create(self, serializer):
		serializer.save()

	@action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
	def check_question(self, request):
			exam_id = request.query_params.get('exam')
			examnumber_id = request.query_params.get('examnumber')
			questionnumber1 = request.query_params.get('questionnumber1')
			questionnumber2 = request.query_params.get('questionnumber2')

			if not all([exam_id, examnumber_id, questionnumber1, questionnumber2]):
					return Response({"error": "exam, examnumber, questionnumber1, and questionnumber2 are required."}, status=400)

			exists = Question.objects.filter(
					exam_id=exam_id,
					examnumber_id=examnumber_id,
					questionnumber1=questionnumber1,
					questionnumber2=questionnumber2
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

			exists = Mainsubject.objects.filter(exam_id=exam_id, mainnumber=mainnumber).exists()
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
	permission_classes = [permissions.AllowAny]

	def perform_create(self, serializer):
		mainsubject_data = self.request.data.get('mainsubject', [])
		detailsubject_data = self.request.data.get('detailsubject', [])
		explanation = serializer.save(nickname=self.request.user)
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

    def perform_create(self, serializer):
        serializer.save(nickname=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()

        if instance.content != self.request.data.get("content", ""):
            WikiVersion.objects.create(
                page=instance,
                content=instance.content,
                nickname=self.request.user  # null 허용이므로 비로그인 처리도 가능
            )

        serializer.save()
				
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        page = self.get_object()
        versions = page.versions.all().order_by('-edited_at')
        serializer = WikiVersionSerializer(versions, many=True)
        return Response(serializer.data)
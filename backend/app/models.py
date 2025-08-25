from django.db import models
from django.db.models import Count, Q
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth import get_user_model  # get_user_model 추가
from django.core.exceptions import ValidationError


from django_rest_passwordreset.signals import reset_password_token_created
from django.dispatch import receiver 
from django.urls import reverse 
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from django.utils.text import slugify
from shortuuid.django_fields import ShortUUIDField, ShortUUID
import bleach
from django.utils import timezone

class CustomUserManager(BaseUserManager): 
		
    def create_user(self, email, password=None, **extra_fields ): 
        if not email: 
            raise ValueError('Email is a required field')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields): 
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractUser):
    email = models.EmailField(max_length=200, unique=True)
    nickname = models.CharField(max_length=100, null=True, blank=True, unique=True)
    birthday = models.DateField(null=True, blank=True)
    username = models.CharField(max_length=200, null=True, blank=True)
    address = models.CharField(max_length=300, null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=False)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

# get_user_model()을 통해 사용자 모델을 가져옴
User = get_user_model()

class Exam(models.Model):
    STATUS = (
        ("Active", "Active"),
        ("Draft", "Draft"),
        ("Disabled", "Disabled"),
    )

    EXAMTYPE = (
        ("License", "자격증"),
        ("Public",  "공무원"),
        ("Recruit", "기업채용"),
        ("Other",   "기타"),
    )

    # 채용기관 (공무원일 때만 사용)
    RAGENT = (
        ("국가직", "국가직"),
        ("지방직", "지방직"),
        ("서울시", "서울시"),
        ("국회직", "국회직"),
        ("법원직", "법원직"),
        ("경찰",   "경찰"),
        ("소방",   "소방"),
        ("해경",   "해경"),
        ("군무원", "군무원"),
        ("기상직", "기상직"),
        ("지역인재", "지역인재"),
        ("계리직", "계리직"),
        ("간호직", "간호직"),
        ("비상대비", "비상대비"),
    )

    # Ragent별 허용 직급(옵션) 맵
    _RPOSITION_MAP = {
        "국가직": ["5급", "5급경력", "5급승진", "7급", "9급"],
        "지방직": ["7급", "9급"],
        "서울시": ["7급", "9급", "9급경력", "연구직", "지도직"],
        "국회직": ["5급", "8급", "9급"],
        "법원직": ["5급", "5급승진", "9급"],
        "경찰":   ["간부후보", "경력채용", "공채", "승진시험", "특공대", "경찰대편입"],
        "소방":   ["간부후보", "경력채용", "공채", "승진시험"],
        "해경":   ["간부후보", "경력채용", "공채", "승진시험"],
        "군무원": ["5급", "7급", "9급"],
        "기상직": ["7급", "9급"],
        # 아래 4개는 직급 필수 조건 없음(명시 X)
        "지역인재": [],
        "계리직": [],
        "간호직": [],
        "비상대비": [],
    }

    # UI를 위한 전체 직급 선택지(필요 시)
    RPOSITION_ALL = sorted({p for arr in _RPOSITION_MAP.values() for p in arr})
    RAGENT_NEED_POSITION = {"국가직", "지방직", "서울시", "국회직", "법원직", "경찰", "소방", "해경", "군무원", "기상직"}
    RAGENT_NEED_RGROUP   = {"국가직", "지방직", "서울시", "국회직", "법원직"}

    examname = models.CharField(max_length=200, unique=True, null=False)
    examtype = models.CharField(max_length=20, choices=EXAMTYPE, null=False, default="License")

    # 조건부 필드들: DB 레벨에선 optional로 두고, 검증은 clean()/serializer에서 강제
    ragent    = models.CharField(max_length=10, choices=RAGENT, null=True, blank=True)
    rposition = models.CharField(max_length=20, null=True, blank=True)  # choices는 검증으로 제한
    # 요청: 국가직/지방직/서울시/국회직/법원직 선택 시 rgroup 텍스트 입력(고유)
    # unique=True를 그대로 적용하면 전체 Exam에서 전역 고유 제약이니, 의도라면 유지.
    rgroup    = models.CharField(max_length=20, unique=True, null=True, blank=True)

    def __str__(self):
        # 사람이 보기 좋은 표시 (examtype 레이블 + ragent/rposition/rgroup 일부)
        parts = [self.examname, self.get_examtype_display()]
        if self.examtype == "Public":
            if self.ragent:
                parts.append(self.ragent)
            if self.rposition:
                parts.append(self.rposition)
            if self.rgroup:
                parts.append(self.rgroup)
        return " / ".join(parts)

    def clean(self):
        # 모델 레벨 검증 (admin/ORM 사용 시 안전망)
        if self.examtype == "Public":
            # ragent 필수
            if not self.ragent:
                raise ValidationError({"ragent": "공무원 시험은 채용기관(Ragent)을 반드시 선택해야 합니다."})

            # rposition 필수 여부 판단
            if self.ragent in self.RAGENT_NEED_POSITION:
                if not self.rposition:
                    raise ValidationError({"rposition": f"{self.ragent}은(는) 직급(Rposition)을 반드시 선택해야 합니다."})
                # 허용 값 체크
                allowed = set(self._RPOSITION_MAP.get(self.ragent, []))
                if self.rposition not in allowed:
                    raise ValidationError({"rposition": f"{self.ragent}에서는 {sorted(allowed)} 중 하나를 선택해야 합니다."})
            else:
                # 직급 불필수군(지역인재/계리직/간호직/비상대비)
                if self.rposition:
                    # 원치 않으면 여기서 허용하거나 경고/차단 선택 가능. 여기선 허용.
                    pass

            # rgroup 필수 여부 판단
            if self.ragent in self.RAGENT_NEED_RGROUP:
                if not self.rgroup:
                    raise ValidationError({"rgroup": f"{self.ragent}은(는) 직류(Rgroup)를 반드시 입력해야 합니다."})
            else:
                # 불필수군은 비워도 무방
                pass
        else:
            # 공무원이 아니면 세 필드는 모두 비워두는 걸 권장(강제는 아님)
            # 필요 시 아래처럼 아예 초기화해도 됨:
            # self.ragent = None
            # self.rposition = None
            # self.rgroup = None
            pass

        super().clean()

class Examnumber(models.Model):
	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	examnumber = models.PositiveIntegerField(null=False, default=1)
	year = models.PositiveIntegerField(null=False)
	slug = models.SlugField(unique=True, null=True, blank=True)
    
	def __str__(self):
		return str(self.examnumber)

	def save(self, *args, **kwargs):
		if not self.slug:  # slug가 비어 있을 때만 생성
			# exam.examname과 examnumber를 결합하여 slug를 생성
			combined_value = f"{self.exam.examname}({self.examnumber}회, {self.year})"
			self.slug = combined_value
		super(Examnumber, self).save(*args, **kwargs)
    
	def questions(self):
		return Question.objects.filter(examnumber=self).order_by("qsubject", "qnumber")

	class Meta:
			unique_together = ('exam', 'examnumber')  # 복합 유일성 제약 조건

class Question(models.Model):
	TYPE = (
			("Sj", "주관식"), 
			("Oj", "객관식"),
	)

	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	examnumber = models.ForeignKey(Examnumber, on_delete=models.SET_NULL, null=True)
	qtype = models.CharField(max_length=2, choices=TYPE, default="Sj")
	qsubject = models.PositiveIntegerField(null=True)
	qnumber = models.PositiveIntegerField(null=True)
	qtext = models.CharField(max_length=1000)
	slug = models.SlugField(unique=True, null=True, blank=True, max_length=200)
    
	def __str__(self):
		return  f"{self.qsubject} - {self.qnumber} - {self.qtext}"

	def clean(self):
		# 주관식이면 보기 없어도 됨
		if self.qtype == "Sj":
				return

		# 객관식, 최소 2개 보기 권장 & 정답 최소 1개
		opts = list(self.options.all()) if self.pk else []
		if self.qtype == "Oj":
			# 저장 직전 clean은 옵션이 아직 저장 안됐을 수도 있으므로,
			# 실제 검증은 Serializer/폼에서도 한번 수행하는 것을 권장
			pass

	def save(self, *args, **kwargs):
		if not self.slug:
			combined_value = f"{self.examnumber.examnumber}회 {self.qsubject}-{self.qnumber}. {self.qtext}"
			self.slug = combined_value
		super(Question, self).save(*args, **kwargs)
    
	def explanations(self):
		return Explanation.objects.filter(question=self).annotate(like_count=Count('like')).order_by('-like_count')

class Option(models.Model):
	"""객관식 보기. 개수 가변, 정답 복수 허용 가능."""
	question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
	order = models.PositiveSmallIntegerField()            # 보기 번호(1,2,3,...)
	text = models.CharField(max_length=1000)             	# 보기 내용
	is_correct = models.BooleanField(default=False)       # 정답 여부
	is_active = models.BooleanField(default=True)         # 삭제 대신 비활성 처리할 때

	class Meta:
			unique_together = (("question", "order"),)
			indexes = [
					models.Index(fields=["question", "order"]),
					models.Index(fields=["question", "is_correct"]),
			]

	def __str__(self):
			return f"[{self.order}] {self.text[:40]}"

class Mainsubject(models.Model):
	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	mainnumber = models.PositiveIntegerField(null=False)
	mainname = models.CharField(unique=True, max_length=200)
	mainslug = models.SlugField(unique=True, null=True, blank=True)

	def save(self, *args, **kwargs):
		# mainslug 설정
		if not self.mainslug:
			self.mainslug = f"{self.mainnumber}.{self.mainname}"
		super(Mainsubject, self).save(*args, **kwargs)
    
	def __str__(self):
		return  f"{self.mainslug}"

class Detailsubject(models.Model):
	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	mainslug = models.ForeignKey(Mainsubject, on_delete=models.SET_NULL, null=True)
	detailnumber = models.PositiveIntegerField(null=True)
	detailtitle = models.CharField(unique=True, max_length=400, null=True)
	detailslug = models.SlugField(unique=True, null=True, blank=True)

	def save(self, *args, **kwargs):
		# detailslug 설정
		if not self.detailslug:
			self.detailslug = f"{self.mainslug.mainnumber}-{self.detailnumber}.{self.detailtitle}"
		super(Detailsubject, self).save(*args, **kwargs)
    
	def __str__(self):
		return  f"{self.detailslug}"

class Explanation(models.Model):
	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	examnumber = models.ForeignKey(Examnumber, on_delete=models.SET_NULL, null=True)
	mainsubject = models.ManyToManyField(Mainsubject)
	detailsubject = models.ManyToManyField(Detailsubject)
	question = models.ForeignKey(Question, on_delete=models.SET_NULL, null=True)
	nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
	explanation = models.CharField(max_length=5000)
	like = models.ManyToManyField(User, blank=True, related_name="like_explanation")
	bookmark = models.ManyToManyField(User, blank=True, related_name="bookmark_explanation")
	created_at = models.DateTimeField(auto_now_add=True) 
	updated_at = models.DateTimeField(auto_now=True) 

	@property
	def like_count(self):
			return self.like.count()

	@property
	def bookmark_count(self):  # 북마크 수 계산
			return self.bookmark.count()
	
	def save(self, *args, **kwargs):
		# HTML 클린징 적용
		self.explanation = bleach.clean(
				self.explanation,
				tags=['p', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br'],  # 허용할 태그
				attributes={'a': ['href', 'title']},  # 허용할 속성
				strip=True,  # 허용하지 않는 태그 제거
		)
		super(Explanation, self).save(*args, **kwargs)

#######################에세이#######################저자-기관-출판정보-본문
#######################에세이#######################
class Author(models.Model):
    author = models.CharField(max_length=40, null=False, blank=False)

    def __str__(self):
        return f"{self.author}"

class Agency(models.Model):
    agency = models.CharField(max_length=50, null=False, blank=False)

    def __str__(self):
        return self.agency

class Publication(models.Model):
    CATEGORY_CHOICES = [
        ('article', '학술논문'),
        ('research', '연구보고서'),
        ('dissertation', '박사학위논문'),
        ('thesis', '석사학위논문'),
    ]
    category = models.CharField(max_length=15, choices=CATEGORY_CHOICES)
    year = models.PositiveIntegerField(null=False)
    title = models.TextField(max_length=1000, null=True, blank=True)
    agency = models.ForeignKey('Agency', on_delete=models.SET_NULL, null=True, blank=True)
    volume = models.PositiveIntegerField(null=True, blank=True)
    issue = models.PositiveIntegerField(null=True, blank=True)
    start_page = models.PositiveIntegerField(null=True, blank=True)
    end_page = models.PositiveIntegerField(null=True, blank=True)
    link = models.TextField(max_length=2000, null=True, blank=True)
    combined_author = models.CharField(max_length=255, blank=True)
    extra_author = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.title

class Paper(models.Model):
	publication = models.ForeignKey(Publication, on_delete=models.SET_NULL, null=True)
	nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
	title = models.CharField(max_length=500, null=False, blank=False)
	contents = models.CharField(max_length=5000, null=True, blank=True, default="")
	like = models.ManyToManyField(User, blank=True, related_name="like_Paper")
	bookmark = models.ManyToManyField(User, blank=True, related_name="bookmark_Paper")
	created_at = models.DateTimeField(auto_now_add=True) 
	updated_at = models.DateTimeField(auto_now=True) 

	@property
	def like_count(self):
			return self.like.count()

	@property
	def bookmark_count(self):  # 북마크 수 계산
			return self.bookmark.count()
	
	def save(self, *args, **kwargs):
		# HTML 클린징 적용
		self.contents  = bleach.clean(
				self.contents,
				tags=['p', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br'],  # 허용할 태그
				attributes={'a': ['href', 'title']},  # 허용할 속성
				strip=True,  # 허용하지 않는 태그 제거
		)
		super(Paper, self).save(*args, **kwargs)

	def __str__(self):
			return f"Paper on {self.publication}"

#######################댓글#######################

class Comment(models.Model):
	content = models.TextField()  # 댓글 내용
	nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
	explanation = models.ForeignKey(Explanation, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments_ex')
	paper = models.ForeignKey(Paper, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments_pa')
	like = models.ManyToManyField(User, blank=True, related_name="like_comment") 
	created_at = models.DateTimeField(auto_now_add=True) 
	updated_at = models.DateTimeField(auto_now=True) 

	def like_count(self):
		return self.like.count()

	def __str__(self):
		return f"Comment by {self.nickname} on {self.created_at}"

#######################위키#######################

class WikiPage(models.Model):
    title = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    content = models.TextField(blank=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='wiki_pages')

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title, allow_unicode=True)  # 한글 허용
            candidate = base or "page"
            i = 2
            # 유니크 보장
            while WikiPage.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{i}"
                i += 1
            self.slug = candidate
        super().save(*args, **kwargs)

class WikiVersion(models.Model):
    page = models.ForeignKey('WikiPage', on_delete=models.CASCADE, related_name='versions')
    content = models.TextField()
    edited_at = models.DateTimeField(auto_now_add=True)
    nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='wiki_versions')

    class Meta:
        ordering = ['-edited_at']  
        indexes = [
            models.Index(fields=['page', '-edited_at']),
        ]

    def __str__(self):
        return f"{self.page.title} - {self.edited_at.strftime('%Y-%m-%d %H:%M:%S')}"
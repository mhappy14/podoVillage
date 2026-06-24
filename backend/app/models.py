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
from uuid import uuid4

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
        ("PE",       "기술사"),   # Professional Engineer (기술사)
        ("Engineer", "기사"),     # 기사
        ("Public",   "공무원"),
        ("PSAT",     "PSAT"),
    )

    # Recruit Agent (공무원일 때만 사용)
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

    # Recruit Agent Position 옵션 맵
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
    examtype = models.CharField(max_length=20, choices=EXAMTYPE, null=False, default="PE")

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
	slug = models.SlugField(unique=True, null=True, blank=True, max_length=255, allow_unicode=True)

	def __str__(self):
		# 사람이 읽기 좋은 형태: "YYYY(nnn회)"
		return f"{self.year}({self.examnumber}회)"

	def save(self, *args, **kwargs):
		if not self.slug:
			# slug 형식: "{시험명}-{YYYY}({nnn}회)"
			# Examname 이 없을 가능성을 대비해 fallback 처리
			examname = (self.exam.examname if self.exam else "exam") or "exam"
			self.slug = f"{examname}-{self.year}({self.examnumber}회)"
		super(Examnumber, self).save(*args, **kwargs)

	class Meta:
			unique_together = ('exam', 'year', 'examnumber')  # 복합 유일성 제약 조건

class ExamQsubject(models.Model):
    # examstage TYPE은 비-기술사 자격증(1차/2차/3차)에서만 사용. 기술사는 NULL.
    TYPE = (
        ("1st", "1차"),
        ("2nd", "2차"),
        ("3rd", "3차"),
    )

    exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
    # ✨ 기술사처럼 회차별로 같은 esn(교시)이 반복되어야 할 때 사용
    examnumber = models.ForeignKey(Examnumber, on_delete=models.SET_NULL, null=True, blank=True)
    examstage = models.CharField(max_length=3, choices=TYPE, blank=True, null=True)
    esn = models.PositiveIntegerField()  # 과목번호 (기술사: 교시번호 1~4)
    est = models.CharField(blank=True, max_length=200)  # 과목명 (기술사: 빈 문자열 허용)
    slug = models.SlugField(max_length=255, blank=True, allow_unicode=True)

    class Meta:
        constraints = [
            # ✨ 같은 회차 안에서 esn 이 유일 (기술사 회차별 1~4교시)
            models.UniqueConstraint(
                fields=['exam', 'examnumber', 'esn'],
                name='uniq_exam_examnumber_esn'
            ),
            # ✨ est 가 비어있지 않을 때만 (exam, est) unique
            #    기술사처럼 est="" 인 행이 여러 개 공존할 수 있어야 함
            models.UniqueConstraint(
                fields=['exam', 'est'],
                condition=~Q(est=''),
                name='uniq_exam_est_non_empty',
            ),
        ]
        ordering = ['exam_id', 'examnumber_id', 'esn']

    def clean(self):
        # 기사(Engineer)는 시험단계(1차/2차/3차) 필수. 기술사(PE)는 면제.
        if self.exam and self.exam.examtype == "Engineer":
            if not self.examstage:
                raise ValidationError("기사 시험은 시험단계(examstage)가 반드시 필요합니다.")
        # 기술사(PE)가 아닌 시험은 과목명(est) 필수
        if self.exam:
            is_pe = self.exam.examtype == "PE" or "기술사" in (self.exam.examname or "")
            if not is_pe and not self.est:
                raise ValidationError("과목명(est)은 반드시 입력해야 합니다.")

    def save(self, *args, **kwargs):
        self.clean()
        if not self.slug:
            # 기술사의 경우 est=="" 라 esn 만으로 slug 가 충돌할 수 있어 examnumber 도 포함
            en_part = f"-en{self.examnumber_id}" if self.examnumber_id else ""
            base = f"{self.esn}-{self.est}{en_part}"
            self.slug = slugify(base, allow_unicode=True)[:255]
        super().save(*args, **kwargs)

class Question(models.Model):
  TYPE = (
          ("Sj", "주관식"), 
          ("Oj", "객관식"),
  )

  exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
  examnumber = models.ForeignKey(Examnumber, on_delete=models.SET_NULL, null=True)
  examqsubject = models.ForeignKey(ExamQsubject, on_delete=models.SET_NULL, null=True)
  qtype = models.CharField(max_length=2, choices=TYPE, default="Sj")
  qnumber = models.PositiveIntegerField(null=True)
  qtext = models.CharField(max_length=1000)
  qscript = models.CharField(blank=True, null=True, max_length=1000)
  slug = models.SlugField(unique=True, null=True, blank=True, max_length=200, allow_unicode=True)
  slug1 = models.SlugField(unique=True, null=True, blank=True, max_length=200, allow_unicode=True)

  def __str__(self):
    examnum = getattr(self.examnumber, "examnumber", None)
    if self.examqsubject:
      subj_label = self.examqsubject.slug or f"{self.examqsubject.esn}. {self.examqsubject.est}"
    else:
      subj_label = "(과목없음)"
    num = self.qnumber if self.qnumber is not None else "?"
    parts = []
    if examnum is not None:
      parts.append(f"{examnum}회")
    parts.append(subj_label)
    parts.append(str(num))
    return " ".join(parts)

  def clean(self):
    if self.examnumber and self.exam and self.examnumber.exam_id != self.exam.id:
      raise ValidationError({"examnumber": "선택한 회차(Examnumber)는 선택한 시험(Exam)과 다릅니다."})
    if self.examqsubject and self.exam and self.examqsubject.exam_id != self.exam.id:
      raise ValidationError({"examqsubject": "선택한 과목(ExamQsubject)은 선택한 시험(Exam)과 다릅니다."})

  def save(self, *args, **kwargs):
    self.clean()
    if not self.slug:
        examnum = getattr(self.examnumber, "examnumber", None)
        subj_label = None
        if self.examqsubject:
            subj_label = self.examqsubject.slug or f"{self.examqsubject.esn}. {self.examqsubject.est}"
        if examnum is not None and subj_label and self.qnumber is not None and self.qtext:
            base = f"{examnum}회 {subj_label} {self.qnumber} {self.qtext}"
            self.slug = slugify(base, allow_unicode=True)[:200] or None
    if not self.slug:
        self.slug = f"q-{uuid4().hex[:16]}"

    if not self.slug1 and self.examqsubject and self.examqsubject.esn and self.qnumber is not None:
        base2 = f"{self.examqsubject.esn}과목 {self.qnumber}문항"
        cand = slugify(base2, allow_unicode=True)[:200] or None
        if not cand:
            cand = f"q1-{uuid4().hex[:12]}"  # 폴백
        # 유니크 충돌 시 접미사 붙여 회피
        orig = cand
        i = 1
        while Question.objects.filter(slug1=cand).exclude(pk=self.pk).exists():
            suffix = f"-{i}"
            cand = (orig[: (200 - len(suffix))] + suffix)
            i += 1
        self.slug1 = cand

    super().save(*args, **kwargs)

  def explanations(self):
    return (
      Explanation.objects
      .filter(question=self)
      .annotate(like_count=Count('like'))
      .order_by('-like_count')
    )

  class Meta:
    constraints = [
      models.UniqueConstraint(
        fields=['exam', 'examnumber', 'examqsubject', 'qnumber'],
        name='uniq_question_scope'
      )
    ]

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

# =====================================================================
# IndicatorSnapshot — 매크로 지표(분기 첫달 1일 기준) 저장소
# ---------------------------------------------------------------------
# update_indicators 관리 명령어가 매일 자정(미국 시간) 실행되어
# (current quarter, prev quarter, prev year) 3개 anchor 값을 각 지표마다
# fetch + 저장. /invest/indicator-snapshots/ 가 이 테이블을 읽어 응답.
# =====================================================================

class IndicatorSnapshot(models.Model):
    indicator_key = models.CharField(max_length=64, db_index=True)
    quarter_anchor = models.CharField(
        max_length=16,
        help_text="'current' / 'prev_q' / 'prev_y'",
    )
    quarter_date = models.DateField(help_text="기준 분기 첫달 1일")
    observation_date = models.DateField(null=True, blank=True)
    # FRED 가 시리즈별로 제공하는 'Updated' 날짜 (관측일과 다름). FRED 시리즈만 존재.
    series_updated = models.DateField(null=True, blank=True)
    # FRED release 의 차기(예정) 발표일. 예정 발표일이 공시된 경우에만 존재.
    next_release = models.DateField(null=True, blank=True)
    value = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=32, default="fred")
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("indicator_key", "quarter_anchor", "quarter_date")]
        indexes = [
            models.Index(fields=["quarter_date", "quarter_anchor"]),
            models.Index(fields=["indicator_key"]),
        ]
        ordering = ["-quarter_date", "indicator_key"]

    def __str__(self):
        return f"{self.indicator_key}@{self.quarter_anchor}({self.quarter_date}) = {self.value}"


# =====================================================================
# StockDailyData — 개별 종목 일별 OHLCV (yfinance, 일단위)
# ---------------------------------------------------------------------
# /invest/stock-indicators/<symbol>/ 가 이 테이블을 읽어 MA·거래강도·
# Put/Call·신고가/신저가를 계산해 응답.
# 직전 거래일 데이터가 없으면 자동 fetch + upsert 후 응답.
# =====================================================================

class StockDailyData(models.Model):
    ticker      = models.CharField(max_length=20, db_index=True)
    date        = models.DateField()
    open_price  = models.FloatField(null=True, blank=True)
    high_price  = models.FloatField(null=True, blank=True)
    low_price   = models.FloatField(null=True, blank=True)
    close_price = models.FloatField(null=True, blank=True)
    volume      = models.BigIntegerField(null=True, blank=True)
    fetched_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("ticker", "date")]
        indexes = [
            models.Index(fields=["ticker", "-date"]),
        ]
        ordering = ["ticker", "date"]
        verbose_name = "종목 일별 데이터"

    def __str__(self):
        return f"{self.ticker} {self.date} C={self.close_price}"


# =====================================================================
# UserFormula — 사용자가 직접 정의한 종합시그널 공식
# ---------------------------------------------------------------------
# 1단계: 로그인한 이용자가 수식 빌더 UI 로 만든 공식을 저장.
#   · display_text  : 화면에 보여줄 표기(예: "(Σ긍정 − Σ부정) / Σw × 100")
#   · compiled_text : 평가용 표기(JS 호환, 예: "(bullW - bearW) / totalW * 100")
#   · variables     : 공식 안에서 참조된 변수 목록(검증용 메타데이터)
#
# 2단계에서 사용자당 최대 5개 제한을 추가할 예정 (현재는 무제한 + 기본정렬만 적용).
# =====================================================================

class UserFormula(models.Model):
    """사용자가 정의한 종합시그널 공식."""

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="formulas",
    )
    name = models.CharField(max_length=100, help_text="공식 이름")
    description = models.CharField(max_length=255, blank=True, default="")

    # 사람이 읽는 표기 — 수학기호(Σ, ×, ÷, ², √, |·| 등) 포함 가능
    display_text = models.TextField(help_text="수식 표시 텍스트 (수학기호 포함)")
    # 평가용 표기 — 프론트에서 안전 평가 가능한 JS 호환 식
    compiled_text = models.TextField(help_text="평가용 JS 호환 식")

    # 공식 안에서 참조된 변수/함수 메타데이터(예: ["bullW","bearW","totalW"])
    variables = models.JSONField(default=list, blank=True)

    # 기본 공식 표시 여부(시스템 디폴트는 마이그레이션 후 별도 시드)
    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
        ]
        verbose_name = "사용자 정의 공식"
        verbose_name_plural = "사용자 정의 공식"

    def __str__(self):
        return f"[{self.user_id}] {self.name}"


# =====================================================================
# ProjectSite — 필지(대상지) 기반 설계·계획 성과물
# ---------------------------------------------------------------------
# 조경·도시계획·건축 전공 학생이 지도에서 공원부지/유휴부지 등 대상지를
# 선택(연속지적 필지 자동인식 또는 직접 영역 그리기)하고, 그 대상지에 대한
# 본인의 설계·계획안(이미지·PDF·설명·외부링크)을 업로드한다.
# 공원·녹지 담당 공무원 등 열람자는 지도를 탐색하며 업로드된 성과물을
# 열람하고 대상지별 인사이트를 얻는다.
#
# PostGIS 미사용 환경이므로 geometry 는 GeoJSON(JSONField)으로 저장하고,
# 지도 마커/목록용으로 center_lat/lng 를 별도 보관한다.
# =====================================================================

class ProjectSite(models.Model):
    CATEGORY = (
        ("landscape",    "조경"),
        ("urban",        "도시계획·설계"),
        ("architecture", "건축"),
        ("etc",          "기타"),
    )
    SITE_TYPE = (
        ("park",  "공원부지"),
        ("idle",  "유휴부지"),
        ("green", "녹지"),
        ("etc",   "기타"),
    )
    GEOM_SOURCE = (
        ("parcel", "필지 자동인식"),
        ("draw",   "직접 그리기"),
    )
    STATUS = (
        ("published", "공개"),
        ("draft",     "비공개(작성중)"),
    )

    nickname = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="project_sites"
    )
    title       = models.CharField(max_length=300)
    category    = models.CharField(max_length=20, choices=CATEGORY,  default="landscape")
    site_type   = models.CharField(max_length=20, choices=SITE_TYPE, default="park")
    status      = models.CharField(max_length=12, choices=STATUS,    default="published")

    # 설계·계획 내용
    summary      = models.CharField(max_length=500, blank=True, default="")  # 한 줄 개요
    description  = models.TextField(blank=True, default="")                   # 상세 계획·설계 설명
    external_link = models.URLField(max_length=2000, blank=True, default="")  # 포트폴리오/영상 등

    # 대상지(필지/영역) 정보
    # 여러 필지를 한 번에 선택하면 PNU/지번/주소가 구분자로 이어져 길어지므로 TextField 사용
    pnu      = models.TextField(blank=True, default="")  # 필지 고유번호(PNU). 다중 선택 시 콤마로 연결
    jibun    = models.TextField(blank=True, default="")  # 지번. 다중 선택 시 ' / ' 로 연결
    address  = models.TextField(blank=True, default="")  # 주소(도로명/지번). 다중 선택 시 ' / ' 로 연결
    geometry = models.JSONField(null=True, blank=True)                   # GeoJSON geometry
    geometry_source = models.CharField(max_length=10, choices=GEOM_SOURCE, default="parcel")
    center_lat = models.FloatField(null=True, blank=True)
    center_lng = models.FloatField(null=True, blank=True)
    area_sqm   = models.FloatField(null=True, blank=True)  # 면적(㎡)

    like = models.ManyToManyField(User, blank=True, related_name="like_project_site")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category"], name="app_project_categor_idx"),
            models.Index(fields=["site_type"], name="app_project_site_ty_idx"),
            models.Index(fields=["-created_at"], name="app_project_created_idx"),
        ]
        verbose_name = "대상지 성과물"
        verbose_name_plural = "대상지 성과물"

    @property
    def like_count(self):
        return self.like.count()

    def __str__(self):
        return f"{self.title} ({self.get_category_display()})"


class SiteFile(models.Model):
    KIND = (
        ("image", "이미지"),
        ("pdf",   "PDF"),
        ("file",  "파일"),
    )
    site     = models.ForeignKey(ProjectSite, on_delete=models.CASCADE, related_name="files")
    file     = models.FileField(upload_to="project_sites/%Y/%m/")
    kind     = models.CharField(max_length=10, choices=KIND, default="image")
    caption  = models.CharField(max_length=300, blank=True, default="")
    order    = models.PositiveSmallIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"[{self.kind}] {self.file.name}"

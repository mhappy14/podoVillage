from django.db import models
from django.db.models import Count
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth import get_user_model  # get_user_model 추가

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

	examname = models.CharField(max_length=200, unique=True, null=False)
    
	def __str__(self):
		return self.examname

class Examnumber(models.Model):
	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	examnumber = models.PositiveIntegerField(null=False)
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
		return Question.objects.filter(subjectnumber=self).order_by("questionnumber")

	class Meta:
			unique_together = ('exam', 'examnumber')  # 복합 유일성 제약 조건

class Question(models.Model):
	exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True)
	examnumber = models.ForeignKey(Examnumber, on_delete=models.SET_NULL, null=True)
	questionnumber1 = models.PositiveIntegerField(null=True)
	questionnumber2 = models.PositiveIntegerField(null=True)
	questiontext = models.CharField(max_length=1000)
	slug = models.SlugField(unique=True, null=True, blank=True, max_length=200)
    
	def __str__(self):
		return  f"{self.questionnumber1} - {self.questionnumber2} - {self.questiontext}"

	def save(self, *args, **kwargs):
		if not self.slug:
			combined_value = f"{self.examnumber.examnumber}회 {self.questionnumber1}-{self.questionnumber2}. {self.questiontext}"
			self.slug = combined_value
		super(Question, self).save(*args, **kwargs)
    
	def explanations(self):
		return Explanation.objects.filter(question=self).annotate(like_count=Count('like')).order_by('-like_count')

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

	def __str__(self):
		return  f"{self.question.slug}의 해설"

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
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='wiki_pages')

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class WikiVersion(models.Model):
    page = models.ForeignKey('WikiPage', on_delete=models.CASCADE, related_name='versions')
    content = models.TextField()
    edited_at = models.DateTimeField(auto_now_add=True)
    nickname = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='wiki_versions')

    def __str__(self):
        return f"{self.page.title} - {self.edited_at.strftime('%Y-%m-%d %H:%M:%S')}"
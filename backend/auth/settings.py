from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-d_=13q)jowx)exi9)qh!whur4vk^quo9jl-v^@nb=ybcfiac^2'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True



# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'app',
    'knox',
    'django_rest_passwordreset',
    'django_filters',
    'phonenumber_field',
    #wiki — wiki 패키지(`pip install wiki`)가 설치되어야 활성화 가능
    # 'django.contrib.sites.apps.SitesConfig',
    # 'django.contrib.humanize.apps.HumanizeConfig',
    # 'django_nyt.apps.DjangoNytConfig',
    # 'mptt',
    # 'sekizai',
    # 'sorl.thumbnail',
    # 'wiki.apps.WikiConfig',
    # 'wiki.plugins.attachments.apps.AttachmentsConfig',
    # 'wiki.plugins.notifications.apps.NotificationsConfig',
    # 'wiki.plugins.images.apps.ImagesConfig',
    # 'wiki.plugins.macros.apps.MacrosConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = [
 'http://localhost:5173',
]

CORS_ALLOW_CREDENTIALS = True


AUTH_USER_MODEL = 'app.CustomUser'

AUTHENTICATION_BACKENDS = [
    # 'users.authback.EmailBackend',
    "django.contrib.auth.backends.ModelBackend", # this line fixed my problem
]

ROOT_URLCONF = 'auth.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR/"templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                #wiki
                'django.template.context_processors.i18n',
                'django.template.context_processors.media',
                'django.template.context_processors.static',
                'django.template.context_processors.tz',
                "sekizai.context_processors.sekizai",
            ],
        },
    },
]

WSGI_APPLICATION = 'auth.wsgi.application'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'knox.auth.TokenAuthentication',
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
      ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50
}


# ──────────────────────────────────────────────────────────────
# 투자지표 API용 전역 설정
#
# 1) FRED API 키 (환경변수 또는 .env 에 설정)
FRED_API_KEY = os.environ.get('FRED_API_KEY', '6335426c3b0d7423815d6ca3068b1a7f')

# 2) 캐시 백엔드 (간단히 메모리 캐시; 필요시 Redis 등으로 교체)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'invest-indicator-cache',
    }
}

# 3) (필요하면) 타임존·언어 등 나머지 설정…
TIME_ZONE = 'Asia/Seoul'
USE_I18N = True
USE_TZ = True

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'podo_db',
        'USER': 'podo',
        'PASSWORD': 'dlalsgh1!',
        'HOST': 'localhost',  # Docker 사용 시 'db', test 시 'localhost'
        'PORT': '5432',
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

#the email settings
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_PASSWORD')
DEFAULT_FROM_EMAIL = 'CBI ANALYTICS'

# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Seoul'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = 'static/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

#wiki 계정가입여부 — django-wiki 미사용 (자체 WikiPage 모델 사용)
# WIKI_ACCOUNT_HANDLING = True
# WIKI_ACCOUNT_SIGNUP_ALLOWED = True

# SITE_ID = 1   # django.contrib.sites 도 미사용 (위 INSTALLED_APPS 참조)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": { "class": "logging.StreamHandler" },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",  # DEBUG → INFO (pdfminer 폭주 방지)
    },
    "loggers": {
        # pdfminer/pdfplumber 가 매우 verbose 한 DEBUG 로그를 출력하므로
        # 명시적으로 WARNING 으로 제한
        "pdfminer":   {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.pdfinterp":  {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.pdfparser":  {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.pdfdocument":{"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.cmapdb":     {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.pdfpage":    {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.pdfdevice":  {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.converter":  {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfminer.psparser":   {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "pdfplumber": {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        "PIL":        {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        # 우리 앱은 INFO 이상 출력
        "app": {"level": "INFO", "propagate": True},
    },
}
from django.contrib import admin
from django.urls import path, include
from knox import views as knox_views
from app.views import *
from rest_framework.routers import DefaultRouter
from django.urls import path
from app.views import activate_user

router = DefaultRouter()

urlpatterns = [
	path('admin/', admin.site.urls),
	path('', include('app.urls')), #app의 url을 하위에 포함
	# path('api/auth/',include('knox.urls')),

	path('logout/',knox_views.LogoutView.as_view(), name='knox_logout'), 
	path('logoutall/',knox_views.LogoutAllView.as_view(), name='knox_logoutall'), 
	path('api/password_reset/',include('django_rest_passwordreset.urls', namespace='password_reset')), 
	path('api/activate/<str:uid>/<str:token>/', activate_user, name='activate_user'),
  
]

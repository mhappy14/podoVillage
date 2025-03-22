#개인정보 변경 권한 확인

from rest_framework import permissions, viewsets
from app.models import Comment
from app.serializers import CommentSerializer

class IsOwnerOrAdmin(permissions.BasePermission):

    def has_object_permission(self, request, view, obj):
        # 안전한 메서드(GET, HEAD, OPTIONS)에 대해서는 항상 허용
        if request.method in permissions.SAFE_METHODS:
            return True

        # 관리자인 경우 모든 객체에 접근 가능
        if request.user and request.user.is_staff:
            return True

        # 그렇지 않으면, 객체의 소유자인지 확인
        return obj == request.user

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny] 
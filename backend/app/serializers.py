from rest_framework import serializers 
from app.models import * 
from django.contrib.auth import get_user_model, authenticate
User = get_user_model()

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, data):
        email = data.get('email', '')
        password = data.get('password', '')

        if email and password:
            user = authenticate(request=self.context.get('request'), email=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid email or password.")
        else:
            raise serializers.ValidationError("Must include 'email' and 'password'.")

        data['user'] = user
        return data

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta: 
        model = CustomUser
        fields = ['email', 'username', 'password', 'nickname', 'birthday']
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': False, 'allow_blank': True},
            'nickname': {'required': False, 'allow_blank': True},
            'birthday': {'required': False, 'allow_null': True},
            'address': {'required': False, 'allow_blank': True},
            'phone_number': {'required': False, 'allow_blank': True},
        }
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user

class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'username', 'nickname', 'birthday', 'address', 'phone_number']
        read_only_fields = ['id', 'email']

class DeactivateAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['is_active']

    def update(self, instance, validated_data):
        instance.is_active = False
        instance.save()
        return instance

class CommentSerializer(serializers.ModelSerializer):
    nickname = UserSerializer(read_only=True)
    like_count = serializers.ReadOnlyField()

    class Meta:
        model = Comment
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(CommentSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

# 1 시험명Exam(시험명examname)
# 2 시험회차Examnumber(회차examnumber - 연도year)
# 3 문제Question(번호questionnumber1 - 번호questionnumber2 - 문제questiontext - 좋아요 - 북마크 - 날짜)
# 4 주요과목Mainsubject(주요과목번호mainnumber - 주요과목mainname)
# 5 세부과목Detailsubject(세부과목번호detailnumber - 세부과목detailtitle)
# 6 해설Explanation(글쓴이 - 좋아요 - 북마크 - 날짜)
class ExplanationSerializer(serializers.ModelSerializer):
    nickname = UserSerializer(read_only=True)
    comment = CommentSerializer(many=True, read_only=True)
    mainsubject = serializers.SerializerMethodField()  # mainsubject의 상세 정보 반환
    detailsubject = serializers.SerializerMethodField()  # detailsubject의 상세 정보 반환
    like_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()  # 현재 사용자의 좋아요 상태
    bookmark_count = serializers.ReadOnlyField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Explanation
        fields = "__all__"

    def create(self, validated_data):
        mainsubject_data = self.initial_data.get('mainsubject', [])
        detailsubject_data = self.initial_data.get('detailsubject', [])
        explanation = Explanation.objects.create(**validated_data)
        explanation.mainsubject.set(mainsubject_data)
        explanation.detailsubject.set(detailsubject_data)
        return explanation

    def update(self, instance, validated_data):
        mainsubject_data = self.initial_data.get('mainsubject', [])
        detailsubject_data = self.initial_data.get('detailsubject', [])
        instance = super().update(instance, validated_data)
        if mainsubject_data:
            instance.mainsubject.set(mainsubject_data)
        if detailsubject_data:
            instance.detailsubject.set(detailsubject_data)
        return instance

    def get_mainsubject(self, obj):
        """Return detailed information for mainsubject."""
        mainsubjects = obj.mainsubject.all()  # ManyToMany 관계 데이터 가져오기
        return MainsubjectSerializer(mainsubjects, many=True).data

    def get_detailsubject(self, obj):
        """Return detailed information for detailsubject."""
        detailsubjects = obj.detailsubject.all()  # ManyToMany 관계 데이터 가져오기
        return DetailsubjectSerializer(detailsubjects, many=True).data

    def get_like_count(self, obj):
        return obj.like.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.like.filter(id=request.user.id).exists()  # 현재 사용자가 좋아요를 눌렀는지 확인
        return False  # 비로그인 상태에서 기본값은 False
    
    def get_bookmark_count(self, obj):  # 북마크 수 계산 메서드
        return obj.bookmark.count()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmark.filter(id=request.user.id).exists()
        return False

    def __init__(self, *args, **kwargs):
        super(ExplanationSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1


class DetailsubjectSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Detailsubject
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(DetailsubjectSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

class MainsubjectSerializer(serializers.ModelSerializer):
    mainsubject = ExplanationSerializer(many=True, required=False)
    
    class Meta:
        model = Mainsubject
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(MainsubjectSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

class QuestionSerializer(serializers.ModelSerializer):
    comment = CommentSerializer(many=True, read_only=True)
    explanation = ExplanationSerializer(many=True, required=False)
    
    class Meta:
        model = Question
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(QuestionSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

class ExamnumberSerializer(serializers.ModelSerializer):
    comment = CommentSerializer(many=True, read_only=True)
    question = QuestionSerializer(many=True, required=False)
    explanation = QuestionSerializer(many=True, required=False)
    
    class Meta:
        model = Examnumber
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(ExamnumberSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

class ExamSerializer(serializers.ModelSerializer):
    comment = CommentSerializer(many=True, read_only=True)
    examnumber = ExamnumberSerializer(many=True, required=False)
    mainsubject = ExplanationSerializer(many=True, required=False)
    
    class Meta:
        model = Exam
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(ExamSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

#######################에세이#######################
#######################에세이#######################
class ProducerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producer
        fields = '__all__'

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = '__all__'

class PublicationSerializer(serializers.ModelSerializer):
    author = serializers.PrimaryKeyRelatedField(many=True, queryset=Producer.objects.filter(job='author'))
    translator = serializers.PrimaryKeyRelatedField(many=True, queryset=Producer.objects.filter(job='translator'), required=False)

    class Meta:
        model = Publication
        fields = '__all__'

class EssaySerializer(serializers.ModelSerializer):
    nickname = UserSerializer(read_only=True)
    comment = CommentSerializer(many=True, read_only=True)
    publication = PublicationSerializer(read_only=True)
    like_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    bookmark_count = serializers.ReadOnlyField()
    is_bookmarked = serializers.SerializerMethodField()
    
    class Meta:
        model = Essay
        fields = '__all__'

    def create(self, validated_data):
        publication_data = self.initial_data.get('publication')
        if publication_data:
            publication_instance = Publication.objects.get(pk=publication_data)
            validated_data['publication'] = publication_instance
        essay = Essay.objects.create(**validated_data)
        return essay

    def update(self, instance, validated_data):
        publication_data = self.initial_data.get('publication')
        instance = super().update(instance, validated_data)
        if publication_data:
            publication_instance = Publication.objects.get(pk=publication_data)
            instance.publication = publication_instance
            instance.save()
        return instance

    def get_like_count(self, obj):
        return obj.like.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.like.filter(id=request.user.id).exists()  # 현재 사용자가 좋아요를 눌렀는지 확인
        return False  # 비로그인 상태에서 기본값은 False
    
    def get_bookmark_count(self, obj):  # 북마크 수 계산 메서드
        return obj.bookmark.count()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmark.filter(id=request.user.id).exists()
        return False

    def __init__(self, *args, **kwargs):
        super(EssaySerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1
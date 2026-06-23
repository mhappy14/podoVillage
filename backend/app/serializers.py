from rest_framework import serializers 
from django.core.exceptions import ValidationError as DjangoVE
from rest_framework.exceptions import ValidationError
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
    comment = CommentSerializer(source="comments_ex", many=True, read_only=True)
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

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ("id", "order", "text", "is_correct", "is_active")

class ExamQsubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamQsubject
        # ⚠️ examnumber FK 를 반드시 포함시켜야 frontend 가 보낸 값이 저장됨
        fields = ("id", "exam", "examnumber", "examstage", "esn", "est", "slug")

    def validate(self, attrs):
        # ExamQsubject 모델의 clean 로직(자격증이면 examstage 필수)을 보조 검증
        exam = attrs.get("exam", getattr(self.instance, "exam", None))
        examstage = attrs.get("examstage", getattr(self.instance, "examstage", None))

        if exam and getattr(exam, "examtype", None) == "Engineer":
            # ✨ 기사는 시험단계 필수, 기술사(PE)는 면제 — model.clean() 과 동일 규칙
            if not examstage:
                raise serializers.ValidationError(
                    {"examstage": "기사 시험은 시험단계(examstage)가 반드시 필요합니다."}
                )
        else:
            pass
        return attrs

class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False)
    explanation = ExplanationSerializer(source="explanation_set", many=True, read_only=True)
    comment = serializers.SerializerMethodField(read_only=True)
    examqsubject = ExamQsubjectSerializer(read_only=True)
    examqsubject_id = serializers.PrimaryKeyRelatedField(
        queryset=ExamQsubject.objects.all(),
        write_only=True,
        source="examqsubject"
    )

    def get_comment(self, obj):
        qs = Comment.objects.filter(explanation__question=obj)
        return CommentSerializer(qs, many=True).data

    class Meta:
        model = Question
        fields = "__all__"

    # ------- 내부 유틸: 객관식 보기 규칙 -------
    def _validate_mc_rules_payload(self, qtype, options_payload):
        if qtype != "Oj":
            return
        opts = [o for o in options_payload if o.get("is_active", True)]
        if len(opts) < 2:
            raise ValidationError("객관식/TF 문항은 보기가 최소 2개 필요합니다.")
        correct = [o for o in opts if o.get("is_correct")]
        if len(correct) < 1:
            raise ValidationError("객관식/TF 문항은 정답이 최소 1개 필요합니다.")

    def validate(self, attrs):
        # qtype & options 규칙
        qtype = attrs.get("qtype", getattr(self.instance, "qtype", None))
        options_payload = self.initial_data.get("options", []) or []
        self._validate_mc_rules_payload(qtype, options_payload)

        # 관계 정합성: exam / examnumber / examqsubject가 서로 같은 시험 소속인지 검증
        exam = attrs.get("exam", getattr(self.instance, "exam", None))
        examnumber = attrs.get("examnumber", getattr(self.instance, "examnumber", None))
        examqsubject = attrs.get("examqsubject", getattr(self.instance, "examqsubject", None))

        if exam and examnumber and examnumber.exam_id != exam.id:
            raise serializers.ValidationError({"examnumber": "선택한 회차(Examnumber)는 선택한 시험(Exam)과 다릅니다."})

        if exam and examqsubject and examqsubject.exam_id != exam.id:
            raise serializers.ValidationError({"examqsubject": "선택한 과목(ExamQsubject)은 선택한 시험(Exam)과 다릅니다."})

        return attrs

    def create(self, validated_data):
        opts_data = validated_data.pop("options", [])
        q = Question.objects.create(**validated_data)
        for i, od in enumerate(opts_data, start=1):
            Option.objects.create(
                question=q,
                order=od.get("order", i),
                text=od.get("text", ""),
                is_correct=od.get("is_correct", False),
                is_active=od.get("is_active", True),
            )
        return q

    def update(self, instance, validated_data):
        opts_data = validated_data.pop("options", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if opts_data is not None:
            instance.options.all().delete()
            for i, od in enumerate(opts_data, start=1):
                Option.objects.create(
                    question=instance,
                    order=od.get("order", i),
                    text=od.get("text", ""),
                    is_correct=od.get("is_correct", False),
                    is_active=od.get("is_active", True),
                )
        return instance

class ExamnumberSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(source="question_set", many=True, required=False, read_only=True)
    explanation = ExplanationSerializer(source="explanation_set", many=True, required=False, read_only=True)
    # 사람이 읽기 좋은 라벨 — frontend 셀렉터에서 사용
    label = serializers.SerializerMethodField(read_only=True)
    # exam 의 라벨(시험명) 도 함께 노출
    exam_name = serializers.CharField(source="exam.examname", read_only=True, default="")

    class Meta:
        model = Examnumber
        fields = "__all__"

    def get_label(self, obj):
        return f"{obj.year}({obj.examnumber}회)"

class ExamSerializer(serializers.ModelSerializer):
    comment      = CommentSerializer(many=True, read_only=True)
    examnumber   = ExamnumberSerializer(source="examnumber_set", many=True, read_only=True)

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

    def validate(self, attrs):
        # instance가 있는 경우 기존 값 보정
        examtype  = attrs.get("examtype",  getattr(self.instance, "examtype",  None))
        ragent    = attrs.get("ragent",    getattr(self.instance, "ragent",    None))
        rposition = attrs.get("rposition", getattr(self.instance, "rposition", None))
        rgroup    = attrs.get("rgroup",    getattr(self.instance, "rgroup",    None))

        if examtype == "Public":
            if not ragent:
                raise serializers.ValidationError({"ragent": "공무원 시험은 채용기관(Ragent)을 반드시 선택해야 합니다."})

            if ragent in Exam.RAGENT_NEED_POSITION:
                if not rposition:
                    raise serializers.ValidationError({"rposition": f"{ragent}은(는) 직급(Rposition)을 반드시 선택해야 합니다."})
                allowed = set(Exam._RPOSITION_MAP.get(ragent, []))
                if rposition not in allowed:
                    raise serializers.ValidationError({"rposition": f"{ragent}에서는 {sorted(allowed)} 중 하나를 선택해야 합니다."})

            if ragent in Exam.RAGENT_NEED_RGROUP and not rgroup:
                raise serializers.ValidationError({"rgroup": f"{ragent}은(는) 직류(Rgroup)를 반드시 입력해야 합니다."})
        return attrs

    def create(self, validated_data):
        obj = super().create(validated_data)
        obj.full_clean()
        obj.save()
        return obj

    def update(self, instance, validated_data):
        obj = super().update(instance, validated_data)
        obj.full_clean()
        obj.save()
        return obj

#######################에세이#######################

class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = '__all__'

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = '__all__'

class PublicationSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(many=True, read_only=True)
    agency = AgencySerializer(read_only=True)
    # 쓰기 전용 필드로 저자 ID 목록을 받음
    author_ids = serializers.PrimaryKeyRelatedField(
        queryset=Author.objects.all(), many=True, write_only=True
    )

    class Meta:
        model = Publication
        fields = '__all__'
        extra_fields = ['author_ids']

    def create(self, validated_data):
        # write_only 필드에서 저자 ID 목록을 꺼냅니다.
        author_objs = validated_data.pop('author_ids', None)
        publication = Publication.objects.create(**validated_data)
        
        if author_objs:
            # author_objs는 이미 Author 인스턴스 목록입니다.
            author_names = [a.author for a in author_objs]
            
            if len(author_names) < 4:
                # 1~3명의 경우: 단일 Author 인스턴스로 결합
                if len(author_names) == 1:
                    combined_name = author_names[0]
                    extra_author = author_names[0]
                elif len(author_names) == 2:
                    combined_name = f"{author_names[0]} & {author_names[1]}"
                    extra_author = f"{author_names[0]} & {author_names[1]}"
                else:  # 3명
                    combined_name = f"{author_names[0]}, {author_names[1]} & {author_names[2]}"
                    extra_author = f"{author_names[0]}, {author_names[1]} & {author_names[2]}"
            else:
                # 4명 이상인 경우:
                # combined_name: "aaa, bbb, ccc, ddd & eee" 형식
                combined_name = f"{', '.join(author_names[:-1])} & {author_names[-1]}"
                # extra_author: "aaa 외" 형식 (첫 번째 저자만 사용)
                extra_author = f"{author_names[0]} 외"
            
            # Publication 모델의 필드에 저장합니다.
            publication.combined_author = combined_name
            publication.extra_author = extra_author
            publication.save()
                
        return publication
    
class PaperSerializer(serializers.ModelSerializer):
    publication = PublicationSerializer(read_only=True)
    nickname = UserSerializer(read_only=True)
    comment = CommentSerializer(many=True, read_only=True)
    like_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    bookmark_count = serializers.ReadOnlyField()
    is_bookmarked = serializers.SerializerMethodField()
    
    class Meta:
        model = Paper
        fields = '__all__'

    def create(self, validated_data):
        publication_data = self.initial_data.get('publication')
        if publication_data:
            publication_instance = Publication.objects.get(pk=publication_data)
            validated_data['publication'] = publication_instance
        paper = Paper.objects.create(**validated_data)
        return paper

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
        super(PaperSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.method == 'POST':
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1

#######################위키#######################

class WikiPageSerializer(serializers.ModelSerializer):
    nickname_username = serializers.ReadOnlyField(source='nickname.username')

    class Meta:
        model = WikiPage
        fields = ['id', 'title', 'slug', 'content', 'created_at', 'updated_at', 'nickname', 'nickname_username']
        read_only_fields = ['slug', 'created_at', 'updated_at', 'nickname', 'nickname_username']


class WikiVersionSerializer(serializers.ModelSerializer):
    nickname_username = serializers.ReadOnlyField(source='nickname.username')

    class Meta:
        model = WikiVersion
        fields = ['id', 'content', 'edited_at', 'nickname', 'nickname_username']


# =====================================================================
# UserFormula — 사용자가 정의한 종합시그널 공식 (1단계)
# ---------------------------------------------------------------------
# 클라이언트는 display_text(수학기호 포함)와 compiled_text(JS 호환식)를
# 함께 전송. 평가는 프론트에서만 수행하지만, 백엔드도 compiled_text 가
# 화이트리스트 문자/식별자만 포함하는지 1차 검증해 저장.
# =====================================================================

import re as _re


# 한글 등 Unicode 는 string literal (예: w("M2 통화량")) 에 자주 등장 →
# 일반 문자로는 허용하고, 위험성은 키워드/식별자 화이트리스트로 차단.
_FORMULA_ALLOWED_CHARS = _re.compile(
    r"^[\s\d.+\-*/()<>=!&|?:,_\"'\w]+$",
    flags=_re.UNICODE,
)
_FORMULA_ALLOWED_IDENTIFIERS = {
    # 변수 (summary)
    "bullW", "bearW", "neutW", "totalW", "count", "score",
    # Math 헬퍼
    "Math", "abs", "sqrt", "min", "max", "pow", "log", "log10", "exp",
    "PI", "E",
    # 함수 (지표명/시그널)
    "w", "s",
    # 진리값
    "true", "false", "null",
}


class UserFormulaSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = UserFormula
        fields = [
            'id', 'user', 'user_email', 'name', 'description',
            'display_text', 'compiled_text', 'variables',
            'is_default', 'created_at', 'updated_at',
        ]
        read_only_fields = ['user', 'user_email', 'is_default', 'created_at', 'updated_at']

    # ---- validators -------------------------------------------------
    def validate_name(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("공식 이름은 비울 수 없습니다.")
        if len(v) > 100:
            raise serializers.ValidationError("공식 이름은 100자를 넘을 수 없습니다.")
        return v

    def validate_compiled_text(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("평가식이 비어 있습니다.")
        if len(v) > 1000:
            raise serializers.ValidationError("평가식이 너무 깁니다 (최대 1000자).")
        if not _FORMULA_ALLOWED_CHARS.match(v):
            raise serializers.ValidationError("허용되지 않은 문자가 포함되어 있습니다.")
        forbidden = ['__', 'constructor', 'prototype', 'eval', 'Function', 'window',
                     'globalThis', 'this', 'import', 'require', 'process']
        for kw in forbidden:
            if kw in v:
                raise serializers.ValidationError(f"금지된 키워드: {kw}")
        # 식별자 화이트리스트 — string literal 안의 내용은 건너뛴다.
        code_only = _re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'', '""', v)
        for ident in _re.findall(r"[A-Za-z_][A-Za-z_0-9]*", code_only):
            if ident not in _FORMULA_ALLOWED_IDENTIFIERS:
                raise serializers.ValidationError(
                    f"허용되지 않은 식별자: {ident}"
                )
        return v

    def validate_display_text(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("표시식이 비어 있습니다.")
        if len(v) > 2000:
            raise serializers.ValidationError("표시식이 너무 깁니다 (최대 2000자).")
        return v
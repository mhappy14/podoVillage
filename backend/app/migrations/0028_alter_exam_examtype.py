from django.db import migrations, models


def forwards(apps, schema_editor):
    """기존 examtype 값을 새 체계로 변환.

    - License  → PE (기술사)
    - Public   → Public (변동 없음)
    - Recruit  → Engineer (해당 데이터 없음, 안전 폴백)
    - Other    → Engineer (해당 데이터 없음, 안전 폴백)
    """
    Exam = apps.get_model("app", "Exam")
    Exam.objects.filter(examtype="License").update(examtype="PE")
    Exam.objects.filter(examtype="Recruit").update(examtype="Engineer")
    Exam.objects.filter(examtype="Other").update(examtype="Engineer")


def backwards(apps, schema_editor):
    """역마이그레이션: 새 체계 → 구 체계(근사 복원).

    - PE       → License
    - Engineer → License
    - Public   → Public
    - PSAT     → Other
    """
    Exam = apps.get_model("app", "Exam")
    Exam.objects.filter(examtype="PE").update(examtype="License")
    Exam.objects.filter(examtype="Engineer").update(examtype="License")
    Exam.objects.filter(examtype="PSAT").update(examtype="Other")


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0027_indicatorsnapshot_next_release"),
    ]

    operations = [
        # 1) choices/default 변경 전, 기존 데이터를 새 키로 변환
        migrations.RunPython(forwards, backwards),
        # 2) 필드 정의(choices/default) 변경
        migrations.AlterField(
            model_name="exam",
            name="examtype",
            field=models.CharField(
                choices=[
                    ("PE", "기술사"),
                    ("Engineer", "기사"),
                    ("Public", "공무원"),
                    ("PSAT", "PSAT"),
                ],
                default="PE",
                max_length=20,
            ),
        ),
    ]

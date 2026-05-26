from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0023_stockdailydata'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserFormula',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='공식 이름', max_length=100)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('display_text', models.TextField(help_text='수식 표시 텍스트 (수학기호 포함)')),
                ('compiled_text', models.TextField(help_text='평가용 JS 호환 식')),
                ('variables', models.JSONField(blank=True, default=list)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='formulas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': '사용자 정의 공식',
                'verbose_name_plural': '사용자 정의 공식',
                'ordering': ['-updated_at'],
                'indexes': [models.Index(fields=['user', '-updated_at'], name='app_userfor_user_id_upd_idx')],
            },
        ),
    ]

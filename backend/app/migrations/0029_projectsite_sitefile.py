from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('app', '0028_alter_exam_examtype'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectSite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300)),
                ('category', models.CharField(choices=[('landscape', '조경'), ('urban', '도시계획·설계'), ('architecture', '건축'), ('etc', '기타')], default='landscape', max_length=20)),
                ('site_type', models.CharField(choices=[('park', '공원부지'), ('idle', '유휴부지'), ('green', '녹지'), ('etc', '기타')], default='park', max_length=20)),
                ('status', models.CharField(choices=[('published', '공개'), ('draft', '비공개(작성중)')], default='published', max_length=12)),
                ('summary', models.CharField(blank=True, default='', max_length=500)),
                ('description', models.TextField(blank=True, default='')),
                ('external_link', models.URLField(blank=True, default='', max_length=2000)),
                ('pnu', models.CharField(blank=True, default='', max_length=50)),
                ('jibun', models.CharField(blank=True, default='', max_length=200)),
                ('address', models.CharField(blank=True, default='', max_length=300)),
                ('geometry', models.JSONField(blank=True, null=True)),
                ('geometry_source', models.CharField(choices=[('parcel', '필지 자동인식'), ('draw', '직접 그리기')], default='parcel', max_length=10)),
                ('center_lat', models.FloatField(blank=True, null=True)),
                ('center_lng', models.FloatField(blank=True, null=True)),
                ('area_sqm', models.FloatField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('like', models.ManyToManyField(blank=True, related_name='like_project_site', to=settings.AUTH_USER_MODEL)),
                ('nickname', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='project_sites', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '대상지 성과물',
                'verbose_name_plural': '대상지 성과물',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SiteFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='project_sites/%Y/%m/')),
                ('kind', models.CharField(choices=[('image', '이미지'), ('pdf', 'PDF'), ('file', '파일')], default='image', max_length=10)),
                ('caption', models.CharField(blank=True, default='', max_length=300)),
                ('order', models.PositiveSmallIntegerField(default=0)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='app.projectsite')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='projectsite',
            index=models.Index(fields=['category'], name='app_project_categor_idx'),
        ),
        migrations.AddIndex(
            model_name='projectsite',
            index=models.Index(fields=['site_type'], name='app_project_site_ty_idx'),
        ),
        migrations.AddIndex(
            model_name='projectsite',
            index=models.Index(fields=['-created_at'], name='app_project_created_idx'),
        ),
    ]

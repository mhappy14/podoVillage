# Generated by Django 5.1.1 on 2025-03-27 16:46

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='Agency',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('agency', models.CharField(max_length=50)),
            ],
        ),
        migrations.CreateModel(
            name='Author',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('author', models.CharField(max_length=40)),
            ],
        ),
        migrations.CreateModel(
            name='Exam',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('examname', models.CharField(max_length=200, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='CustomUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('email', models.EmailField(max_length=200, unique=True)),
                ('nickname', models.CharField(max_length=100, unique=True)),
                ('birthday', models.DateField(blank=True, null=True)),
                ('username', models.CharField(blank=True, max_length=200, null=True)),
                ('address', models.CharField(blank=True, max_length=300, null=True)),
                ('phone_number', models.CharField(blank=True, max_length=20, null=True)),
                ('is_active', models.BooleanField(default=False)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'user',
                'verbose_name_plural': 'users',
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='Detailsubject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('detailnumber', models.PositiveIntegerField(null=True)),
                ('detailtitle', models.CharField(max_length=400, null=True, unique=True)),
                ('detailslug', models.SlugField(blank=True, null=True, unique=True)),
                ('exam', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.exam')),
            ],
        ),
        migrations.CreateModel(
            name='Examnumber',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('examnumber', models.PositiveIntegerField()),
                ('year', models.PositiveIntegerField()),
                ('slug', models.SlugField(blank=True, null=True, unique=True)),
                ('exam', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.exam')),
            ],
            options={
                'unique_together': {('exam', 'examnumber')},
            },
        ),
        migrations.CreateModel(
            name='Mainsubject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mainnumber', models.PositiveIntegerField()),
                ('mainname', models.CharField(max_length=200, unique=True)),
                ('mainslug', models.SlugField(blank=True, null=True, unique=True)),
                ('exam', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.exam')),
            ],
        ),
        migrations.CreateModel(
            name='Explanation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('explanation', models.CharField(max_length=5000)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('bookmark', models.ManyToManyField(blank=True, related_name='bookmark_explanation', to=settings.AUTH_USER_MODEL)),
                ('detailsubject', models.ManyToManyField(to='app.detailsubject')),
                ('exam', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.exam')),
                ('examnumber', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.examnumber')),
                ('like', models.ManyToManyField(blank=True, related_name='like_explanation', to=settings.AUTH_USER_MODEL)),
                ('nickname', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('mainsubject', models.ManyToManyField(to='app.mainsubject')),
            ],
        ),
        migrations.AddField(
            model_name='detailsubject',
            name='mainslug',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.mainsubject'),
        ),
        migrations.CreateModel(
            name='Paper',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('contents', models.CharField(blank=True, default='', max_length=5000, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('bookmark', models.ManyToManyField(blank=True, related_name='bookmark_Paper', to=settings.AUTH_USER_MODEL)),
                ('like', models.ManyToManyField(blank=True, related_name='like_Paper', to=settings.AUTH_USER_MODEL)),
                ('nickname', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('like', models.ManyToManyField(blank=True, related_name='like_comment', to=settings.AUTH_USER_MODEL)),
                ('nickname', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('explanation', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='comments_ex', to='app.explanation')),
                ('paper', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='comments_pa', to='app.paper')),
            ],
        ),
        migrations.CreateModel(
            name='Publication',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('article', '학술논문'), ('research', '연구보고서'), ('dissertation', '박사학위논문'), ('thesis', '석사학위논문')], max_length=15)),
                ('year', models.PositiveIntegerField()),
                ('title', models.TextField(max_length=1000)),
                ('volume', models.PositiveIntegerField(blank=True, null=True)),
                ('issue', models.PositiveIntegerField(blank=True, null=True)),
                ('start_page', models.PositiveIntegerField(blank=True, null=True)),
                ('end_page', models.PositiveIntegerField(blank=True, null=True)),
                ('link', models.TextField(blank=True, max_length=2000, null=True)),
                ('agency', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.agency')),
                ('author', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.author')),
            ],
        ),
        migrations.AddField(
            model_name='paper',
            name='publication',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.publication'),
        ),
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('questionnumber1', models.PositiveIntegerField(null=True)),
                ('questionnumber2', models.PositiveIntegerField(null=True)),
                ('questiontext', models.CharField(max_length=1000)),
                ('slug', models.SlugField(blank=True, max_length=200, null=True, unique=True)),
                ('exam', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.exam')),
                ('examnumber', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.examnumber')),
            ],
        ),
        migrations.AddField(
            model_name='explanation',
            name='question',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.question'),
        ),
    ]

# Generated by Django 5.1.1 on 2024-10-01 05:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0002_remove_question_qquantity_alter_question_qno_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='slug',
            field=models.SlugField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='question',
            name='slug',
            field=models.SlugField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='subject',
            name='slug',
            field=models.SlugField(blank=True, null=True, unique=True),
        ),
    ]

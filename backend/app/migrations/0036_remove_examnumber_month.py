# Generated by Django 5.1.1 on 2025-01-04 06:32

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0035_remove_explanation_detailsubject_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='examnumber',
            name='month',
        ),
    ]

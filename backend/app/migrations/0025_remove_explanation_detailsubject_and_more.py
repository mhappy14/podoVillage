# Generated by Django 5.1.1 on 2024-10-14 14:50

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0024_detailsubject_exam'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='explanation',
            name='detailsubject',
        ),
        migrations.RemoveField(
            model_name='explanation',
            name='mainsubject',
        ),
        migrations.AddField(
            model_name='explanation',
            name='detailsubject',
            field=models.ManyToManyField(to='app.detailsubject'),
        ),
        migrations.AddField(
            model_name='explanation',
            name='mainsubject',
            field=models.ManyToManyField(to='app.mainsubject'),
        ),
    ]

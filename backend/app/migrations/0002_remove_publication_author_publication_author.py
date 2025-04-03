# Generated by Django 5.1.1 on 2025-04-03 16:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='publication',
            name='author',
        ),
        migrations.AddField(
            model_name='publication',
            name='author',
            field=models.ManyToManyField(blank=True, to='app.author'),
        ),
    ]

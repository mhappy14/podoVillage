# Generated by Django 5.1.1 on 2024-10-12 03:53

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0023_alter_detailsubject_detailnumber_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='detailsubject',
            name='exam',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.exam'),
        ),
    ]

# Generated by Django 5.1.1 on 2025-04-04 15:15

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0005_remove_publication_author'),
    ]

    operations = [
        migrations.AlterField(
            model_name='publication',
            name='title',
            field=models.TextField(blank=True, max_length=1000, null=True),
        ),
    ]

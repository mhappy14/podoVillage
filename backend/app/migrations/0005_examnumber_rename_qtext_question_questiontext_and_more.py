# Generated by Django 5.1.1 on 2024-10-03 13:42

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0004_rename_qno_explanation_question_explanation_exam_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Examnumber',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('examnumber', models.PositiveIntegerField(max_length=10, unique=True)),
                ('year', models.PositiveIntegerField()),
                ('month', models.PositiveIntegerField()),
                ('subjectquantity', models.PositiveIntegerField()),
                ('slug', models.SlugField(blank=True, null=True, unique=True)),
            ],
            options={
                'verbose_name_plural': 'Examnumber',
            },
        ),
        migrations.RenameField(
            model_name='question',
            old_name='qtext',
            new_name='questiontext',
        ),
        migrations.RenameField(
            model_name='subject',
            old_name='sname',
            new_name='subjectname',
        ),
        migrations.RemoveField(
            model_name='exam',
            name='month',
        ),
        migrations.RemoveField(
            model_name='exam',
            name='no',
        ),
        migrations.RemoveField(
            model_name='exam',
            name='squantity',
        ),
        migrations.RemoveField(
            model_name='exam',
            name='year',
        ),
        migrations.RemoveField(
            model_name='question',
            name='qno',
        ),
        migrations.RemoveField(
            model_name='subject',
            name='qquantity',
        ),
        migrations.RemoveField(
            model_name='subject',
            name='sno',
        ),
        migrations.AddField(
            model_name='question',
            name='questionnumber',
            field=models.PositiveIntegerField(default=1, max_length=3),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='subject',
            name='questionquantity',
            field=models.PositiveIntegerField(default=1, max_length=2),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='subject',
            name='subjectnumber',
            field=models.PositiveIntegerField(default=1, max_length=3),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='explanation',
            name='explanation',
            field=models.CharField(max_length=5000, unique=True),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0026_indicatorsnapshot_series_updated'),
    ]

    operations = [
        migrations.AddField(
            model_name='indicatorsnapshot',
            name='next_release',
            field=models.DateField(blank=True, null=True),
        ),
    ]

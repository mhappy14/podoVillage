from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0025_rename_app_stockda_ticker_date_idx_app_stockda_ticker_99d128_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='indicatorsnapshot',
            name='series_updated',
            field=models.DateField(blank=True, null=True),
        ),
    ]

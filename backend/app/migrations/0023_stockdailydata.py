from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0022_alter_examqsubject_options_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='StockDailyData',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ticker', models.CharField(db_index=True, max_length=20)),
                ('date', models.DateField()),
                ('open_price', models.FloatField(blank=True, null=True)),
                ('high_price', models.FloatField(blank=True, null=True)),
                ('low_price', models.FloatField(blank=True, null=True)),
                ('close_price', models.FloatField(blank=True, null=True)),
                ('volume', models.BigIntegerField(blank=True, null=True)),
                ('fetched_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '종목 일별 데이터',
                'ordering': ['ticker', 'date'],
                'indexes': [models.Index(fields=['ticker', '-date'], name='app_stockda_ticker_date_idx')],
                'unique_together': {('ticker', 'date')},
            },
        ),
    ]

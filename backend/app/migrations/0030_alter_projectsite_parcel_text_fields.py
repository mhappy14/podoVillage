from django.db import migrations, models


class Migration(migrations.Migration):
    """
    여러 필지를 한 번에 선택하면 pnu/jibun/address 가 구분자로 이어져
    기존 CharField max_length(50/200/300)를 초과해 저장이 실패했다.
    길이 제한이 없는 TextField 로 변경한다.
    """

    dependencies = [
        ('app', '0029_projectsite_sitefile'),
    ]

    operations = [
        migrations.AlterField(
            model_name='projectsite',
            name='pnu',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='projectsite',
            name='jibun',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='projectsite',
            name='address',
            field=models.TextField(blank=True, default=''),
        ),
    ]

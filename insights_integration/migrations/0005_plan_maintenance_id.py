# Generated by Django 2.0.8 on 2018-11-27 17:08

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('insights_integration', '0004_playbookrunlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='maintenance_id',
            field=models.IntegerField(default=0),
            preserve_default=False,
        ),
    ]
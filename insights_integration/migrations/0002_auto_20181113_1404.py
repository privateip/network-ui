# Generated by Django 2.0.8 on 2018-11-13 14:04

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('insights_integration', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='playbookrun',
            name='create_time',
        ),
        migrations.RemoveField(
            model_name='playbookrun',
            name='end_time',
        ),
        migrations.RemoveField(
            model_name='playbookrun',
            name='start_time',
        ),
    ]
from rest_framework import serializers
{%for model in models%}
from {{app}}.models import {{model.name}}
{%-endfor%}

{%for model in models%}
class {{model.name}}Serializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = {{model.name}}
        fields = ({%for field in model.fields%}{%if not field.pk%}'{{field.name}}',{%endif%}{%endfor%})

{%endfor%}


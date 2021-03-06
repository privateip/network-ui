{%for model in models-%}
{%-if model.api-%}
#---- create_{{model.name.lower()}}

from ansible.plugins.action import ActionBase

import requests
import json


class ActionModule(ActionBase):

    BYPASS_HOST_LOOP = True

    def run(self, tmp=None, task_vars=None):
        if task_vars is None:
            task_vars = dict()
        result = super(ActionModule, self).run(tmp, task_vars)

        server = self._task.args.get('server',
                                     "{0}:{1}".format(self._play_context.remote_addr,
                                                              self._play_context.port))
        user = self._task.args.get('user', self._play_context.remote_user)
        password = self._task.args.get('password', self._play_context.password)

        var = self._task.args.get('var', None)
        the_list = self._task.args.get('list', None)
        list_var = self._task.args.get('list_var', None)
{%for field in model.fields%}{%if not field.pk and field.default is not defined%}
        {{field.name}} = self._task.args.get('{{field.name}}', None){%endif%}{%endfor%}
{%for field in model.fields%}{%if not field.pk and field.default is defined%}
        {{field.name}} = self._task.args.get('{{field.name}}', {{field.default}}){%endif%}{%endfor%}

        url = server + '{{model.v2_end_point}}'
        headers = {'content-type': 'application/json'}
        response = requests.post(url, data=json.dumps(dict({%for field in model.fields%}{%if not field.pk%}{{field.name}}={{field.name}},
                                                           {%endif%}{%endfor%})),
                                 verify=False,
                                 auth=(user, password),
                                 headers=headers)
        if var is not None:
            result['ansible_facts'] = {var: response.json()}
        elif list_var is not None:
            if the_list is None:
                the_list = []
            the_list.append(response.json())
            result['ansible_facts'] = {list_var: the_list}
        return result

{%endif%}
{%endfor%}

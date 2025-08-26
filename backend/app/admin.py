from django.contrib import admin
from .models import *

admin.site.register(CustomUser)
admin.site.register(Exam)
admin.site.register(Examnumber)
admin.site.register(ExamQsubject)
admin.site.register(Question)
admin.site.register(Mainsubject)
admin.site.register(Detailsubject)
admin.site.register(Explanation)
admin.site.register(Comment)
admin.site.register(Paper)
admin.site.register(Author)
admin.site.register(Publication)
admin.site.register(WikiPage)
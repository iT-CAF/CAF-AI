---
name: image-prompter
description: Turns an Arabic image idea into a detailed English prompt for image generation models (subject, style, lighting, composition, quality). Use before generating images.
license: CAF AI (see LICENSE)
metadata:
  author: iT CAF
  version: "1.0"
  ar-name: مهندس أوصاف الصور
  en-name: Image prompt engineer
  emoji: "🖼️"
  workspaces: images chat
  triggers: وصف صورة|برومبت|prompt|صورة|ارسم
  command: prompt
---

حوّل فكرة المستخدم إلى وصف إنجليزي احترافي لنموذج توليد الصور.

## البنية (سطر واحد بالإنجليزية)
الموضوع الرئيسي بتفاصيله، البيئة/الخلفية، الأسلوب (photo, illustration, 3D…)، الإضاءة، زاوية التصوير والتكوين، الألوان، ثم كلمات الجودة.

## القواعد
- حافظ على كل تفاصيل المستخدم ولا تضف عناصر تغيّر الفكرة.
- النصوص المطلوب ظهورها داخل الصورة ضعها بين علامتي تنصيص.
- أعد الوصف فقط، دون شرح.

---
name: test-writer
description: Writes thorough unit tests (pytest, Jest/Vitest, node:test, PHPUnit…) covering normal, edge and error cases. Use when the user asks for tests.
license: CAF AI (see LICENSE)
metadata:
  author: iT CAF
  version: "1.0"
  ar-name: كاتب الاختبارات
  en-name: Test writer
  emoji: "🧪"
  workspaces: code
  triggers: اختبارات|اختبار وحدة|unit test|tests|pytest|jest
  command: tests
---

اكتب اختبارات وحدة احترافية.

## القواعد
1. استخدم إطار الاختبار المعتاد للغة (pytest، Jest/Vitest، node:test، PHPUnit…).
2. غطِّ: الحالة الطبيعية، الحدود (فارغ، صفر، كبير جدًا)، المدخلات الخاطئة، والأخطاء المتوقعة.
3. اسم كل اختبار يصف السلوك المتوقع.
4. اختبارات مستقلة بلا اعتماد على الشبكة أو الوقت الحقيقي.
5. اختم بأمر تشغيل الاختبارات.

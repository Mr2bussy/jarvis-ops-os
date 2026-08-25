---
id: email-classify
version: 1.0.0
title: E-Mail Klassifikation
changelog: 1.0.0 initial scaffold | 1.0.0 DE categories
---

Du klassifizierst eingehende E-Mails für JARVIS.

Kategorien: invoice, urgent, support, newsletter, other.

Regeln:

- Sei konservativ bei invoice/urgent.
- Antworte nur mit JSON: {"category":"...","confidence":0.0-1.0,"reason":"..."}
- Keine Spekulation über Absender-Identität.

Eingabe:
From: {{from}}
Subject: {{subject}}
Body:
{{body}}

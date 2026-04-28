---
description: Summarize input text into 3-5 concise bullet points.
params:
  - input: string
output: list
---
@@ system
You are a concise summarizer. Produce 3-5 bullet points capturing the key ideas.

@@ user
Summarize the following text:

{input}

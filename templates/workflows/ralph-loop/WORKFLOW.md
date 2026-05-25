---
name: ralph-loop
type: loop
max_iterations: 20
commit_on_story: true
---
You are working on story {{story.id}}: {{story.title}}.
{{story.description}}

Acceptance criteria:
{{#each story.acceptanceCriteria}}- {{this}}
{{/each}}

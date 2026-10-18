# The page format

What a discussion is made of, and what an agent may write into it. A page is
written against this file: anything it does not describe renders as plain
text.

## A discussion

A discussion works on a page of the knowledge base itself, a task's page
`pages/<key>-<slug>.md` or a freestyle topic's own page `pages/<key>.md`,
on a branch of the knowledge base's repository, `discussion/<key>`, checked
out in a worktree beside it. A freestyle topic has no task behind it, an
agent's analysis for instance: `topic open <key> --freestyle [<title>]`
creates its page on the branch when there is none, as one heading block
with the title, so a topic discarded leaves no page and one closed lands
its page on `main`. The knowledge base
is `TOPIC_OVERVIEW_KB`; the worktrees are under `TOPIC_OVERVIEW_WORKTREES`,
or a folder `worktrees` beside the knowledge base. A topic has at most one
open discussion, so its key names everything the discussion has:

| Path | Holds |
|---|---|
| `<worktrees>/<key>/` | the worktree, the branch checked out; the source is read and changed here |
| `<worktrees>/<key>.json` | the discussion's state, beside the worktree rather than in it, so git never sees it |

Every change to the source is one commit on the branch, `<key>: <what
changed>`, made by a `topic` command or by the Edit button, which runs the
same command. What is new on `main` is merged into the branch as it lands,
never rebased; a merge that conflicts stops, blocks every change, and is
resolved in the terminal. `topic close` merges `main` one last time,
removes the ids the tool gave blocks unless a reference points at one, and
squashes the branch into one commit on `main`, `<key>: <phase>`, where the
phase is what the page's Task Progress names; a discussion that changed
nothing makes no commit. `--discard` merges nothing. Either way the
worktree, the branch and the state are removed, the state last, so a close
that stopped part way is finished by closing again.

The state is written only by the tool, the commands and the view's server.
An agent reads it, for a browser tab's endpoint for instance, and never
writes it.

## The page

A nested markdown list in Logseq's conventions. Every bullet is a block, and
its tab depth nests it under the bullet above.

```markdown
---
key: value
---
- # A heading
  id:: 7f1c…
	- A regular block, nested under the heading
	- Another, with a property
	  colour:: blue
```

- **Ids.** A block's id is an `id::` property on the line after it, and no
  id repeats. A block needs none: the view numbers the blocks without one by
  their place, `b3.2.5` being the fifth child of the second child of the
  third block at the top, and writes nothing back. A block is given an id
  when something has to address it, by a command, the Edit button or a
  question, in a commit of its own; the state records it, and closing
  removes it unless a `((reference))` points at it.
- **Properties.** Any other `key:: value` line under a bullet is a property of
  that block. `replace` keeps them; `set-property` changes one of them.
- **Frontmatter.** The `---` block at the top is kept as it is; no command
  touches it. Its `icon`, such as an emoji, becomes the icon of the browser
  tab.
- **Continuation lines.** A line indented under a bullet, other than a
  property, continues the block's text, keeping its own indentation.

### Block kinds

| Kind | Written as |
|---|---|
| Heading | a bullet starting with `#` to `######` |
| Regular block | any other bullet |

A block with children that sits at the top level is a section: it folds, and
it is listed in the outline with the headings inside it.

### Inside a block

| Element | Written as | Shown as |
|---|---|---|
| Bold, italic, code | `**bold**`, `*italic*`, `` `code` `` | as written |
| Link | `[text](url)`, or a bare `https://…` | a link that opens in a new tab |
| Link to a GitLab merge request | a link ending in `/-/merge_requests/<number>`, on a host `TOPIC_OVERVIEW_GITLAB_HOSTS` lists | the link with the request's state: open, draft, merged or closed |
| Image | `![alt](../assets/picture.png)`: a file in the knowledge base's `assets/` | its name; hovering previews it, and clicking opens it beside |
| Link to a document | `[name](../assets/plan.md)`: a markdown file in the knowledge base's `assets/` | its name; hovering previews it, and clicking opens it beside, with its tables and diagrams drawn |
| Reference to a block | `((7f1c…))` | a link to the block; hovering shows its text. A block on another page of the knowledge base is shown by its first line, linking to its page; hovering shows the lines under it |
| Link to another page | `[[page name]]` | hovering previews the page; clicking opens it beside |
| Label | `R2:` at the start of a block: capitals and a number, then a colon | names the block |
| Mention of a label | `R2` anywhere else, such as `(R2)` | a link to the labelled block |
| Task marker | `DONE`, `NOW` or `LATER` at the start of a block | the block's state |
| Code block | a fenced block, ```` ``` ```` | code |
| Table | a markdown table | the table; hovering a reference to the block previews it |
| Diagram | a fenced block marked `mermaid` or `bpmn` | the diagram, or its error and source |

A reference or a mention relates two blocks: pointing at either highlights
the other. Inside code, nothing relates. A reference that names no block,
on the page or elsewhere in the knowledge base, is reported with the block
holding it rather than rendered wrong; a command refuses a change that
would leave one.

### Diagrams

| Notation | Marked | Rendered by |
|---|---|---|
| Mermaid: flowcharts, sequence, class and state diagrams, and the rest of what Mermaid draws | `mermaid` | Mermaid |
| BPMN 2.0, as XML with its layout | `bpmn` | bpmn-js |

A diagram that cannot be rendered shows the error and its source instead.

### A task page

A page whose frontmatter has a `task_title` is a task page, and gets a header
that stays in view:

- the key, the first word of the first heading
- the `phase`, coloured by the `status` from the frontmatter
- the `NOW` step under the heading `Task Progress`, and the `NOW` items directly
  under the heading `Action Plan`, each a link to its block

The merge requests linked under its `Links` heading are the discussion's
merge-request integrations, each shown with its state; one linked anywhere
else is context, not something the topic depends on.

## `<key>.json`

The discussion's state: what is not the source, and ends with the
discussion.

```json
{
  "key": "WFC-1144",
  "page": "pages/WFC-1144-the_slug.md",
  "branch": "discussion/WFC-1144",
  "opened": "2026-10-14T08:00:00.000Z",
  "tmux": { "session": "WFC-1144", "window": "assistant" },
  "integrations": [
    { "id": "local:project:dev", "kind": "local", "reference": "project:dev" },
    { "id": "browser:http://localhost:3000/", "kind": "browser", "reference": "http://localhost:3000/",
      "tab": { "id": "…", "endpoint": "http://127.0.0.1:9223", "webSocket": "ws://127.0.0.1:9223/devtools/page/…" } }
  ],
  "ids": ["7f1c…"],
  "marks": [{ "id": "7f1c…", "kind": "changed", "before": "what the block read" }],
  "questions": [
    {
      "id": "4f4e0645", "block": "7f1c…", "text": "what the block read when asked", "commit": "51f5db8",
      "exchanges": [{ "prompt": "…", "asked": "…", "answer": "…", "answered": "…" }]
    }
  ]
}
```

| Field | Holds |
|---|---|
| `key`, `page`, `branch`, `opened` | the topic, its source relative to the knowledge base, the branch, and when it was opened |
| `tmux` | where the discussion's agent runs: a tmux `session`, and a `window` in it when not its first. Absent, the agent is the first window of the session named after the key. A freestyle topic's agent is `discussions:<key>`, a window `topic open --freestyle` creates with a Claude session started at the knowledge base. `topic agent` sets it; the agent is looked up each time, so whoever runs there now is asked |
| `session` | the Claude session `topic open --session` was told of, its `id` and `transcript`. Rarely set: the agent's state and transcript are read off its tmux window, which its hooks mark |
| `integrations` | what the discussion depends on outside its source, each `id` being `<kind>:<reference>`, so one is never added twice; `label` and `detail` are what it is shown as. Merge requests are read off the page's Links and never kept here |
| `ids` | the ids the tool gave blocks, each in a commit of its own, removed at close unless a `((reference))` anywhere in the knowledge base points at one |
| `marks` | the blocks the agent changed that I have not confirmed seeing: the block's `id`, its `kind`, `changed`, `new`, `moved` or `removed`, and `before`, what it read before or where it was. A removed block has no id left, so its mark keeps its `text`, with `next`, the block that follows in its place, or `parent`, when it was the last child. A mark keeps the first kind it was given; a check in the view clears it |
| `questions` | what I asked, until I dismiss it. Each is an exchange: the first prompt, then each follow-up, asked once the one before is answered, with `asked` and `answered` times. A question about a block has `block`, its id, and `text`, what the block read when asked; a general one has neither. `commit` is where the branch was. A question a fork answers has `session`, the fork's own session id, chosen when it is asked; its follow-ups continue that fork, and dismissing it deletes the fork's transcript |
| `closed` | the commit on `main` the discussion was squashed into, set while what is left of it is removed, so closing again finishes a removal that stopped part way |

The integration kinds and their references:

| Kind | Reference | Shows |
|---|---|---|
| `merge-request` | the merge request's URL, from Links | open, draft, merged or closed |
| `local` | `project:process`, a process of the process manager | running, exited or not started; its window is brought up, started or restarted from the view |
| `cluster` | `context/namespace/deployment`, in a context `TOPIC_OVERVIEW_KUBE_CONTEXTS` lists, asked read-only | the rollout's state and the environment the context is given there |
| `jenkins` | `job#number`, with folders written `folder/job`, never a job alone, since others start the same job | the build's state until it finishes, which is not asked again. The server is `TOPIC_OVERVIEW_JENKINS_URL`, asked as `TOPIC_OVERVIEW_JENKINS_USER` with `TOPIC_OVERVIEW_JENKINS_TOKEN` |
| `browser` | the page's URL, `http://` or `https://` | whether its tab is open, not open or failed to load. The view opens it in a Chrome of its own the first time a page of the discussion watches it, and records the `tab`: its `id`, the browser's CDP `endpoint`, and the tab's `webSocket`, which a client attaches to in order to control it. The tabs are closed with the discussion |

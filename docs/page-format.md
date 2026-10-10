# The page format

What a discussion is made of, and what an agent may write into it. A page is
written against this file: anything it does not describe renders as plain
text.

## A discussion

A discussion is a directory, `<source>/<started-at>/`, and a git repository of
its own. It holds:

| File | Holds |
|---|---|
| `page.md` | the content, as blocks |
| `discussion.json` | the source, when it was opened and closed, the sessions that worked on it, and the comments |
| `attachments/` | diagrams, tables and images that belong to the discussion, with `index.json` describing them |

A new version is saved with `topic save <source> <directory> --from <version>
--session <id>`, where the directory holds `page.md` and, when the version
brings attachments, `attachments/`. A version that brings no attachments keeps
the previous ones. `--from` names the version the copy was made from; a copy
made from an outdated version is refused.

## page.md

A nested markdown list. Every bullet is a block, and its tab depth nests it
under the bullet above.

```markdown
---
key: value
---
- # A heading
  id:: b1
	- A regular block, nested under the heading
	  id:: b2
```

- **Ids.** Every block carries its id as an `id::` property on the line after
  it, and no id repeats. A page without them is refused when it is saved.
- **Properties.** Any other `key:: value` line under a bullet is a property of
  that block.
- **Frontmatter.** The `---` block at the top is kept as it is.
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
| Reference to a block | `((b7))` | a link to the block; hovering shows its text |
| Link to another page | `[[page name]]` | hovering previews the page; clicking opens it beside |
| Label | `R2:` at the start of a block: capitals and a number, then a colon | names the block |
| Mention of a label | `R2` anywhere else, such as `(R2)` | a link to the labelled block |
| Task marker | `DONE`, `NOW` or `LATER` at the start of a block | the block's state |
| Code block | a fenced block, ```` ``` ```` | code |
| Diagram | a fenced block marked `mermaid` or `bpmn` | the diagram, or its error and source |

A reference or a mention relates two blocks: pointing at either highlights
the other. Inside code, nothing relates.

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

## Attachments

A diagram, a table or an image that belongs to the discussion but need not
come from its source. Each is a file in `attachments/`, listed in
`attachments/index.json`:

```json
[
  {
    "id": "a1",
    "file": "a1-flow.mmd",
    "kind": "mermaid",
    "title": "From seed to harvest",
    "author": "agent",
    "blocks": ["b3"],
    "time": "2026-10-13T08:00:00Z"
  }
]
```

| Field | Holds |
|---|---|
| `id` | the attachment's id, unique in the discussion |
| `file` | the file's name inside `attachments/`, never a path |
| `kind` | `mermaid`, `bpmn`, `table` or `image` |
| `title` | the title it is listed and shown under |
| `author` | who wrote it |
| `blocks` | the ids of the blocks it is about; pointing at it highlights them |
| `time` | when it was written |

| Kind | File |
|---|---|
| `mermaid` | Mermaid source, such as `.mmd` |
| `bpmn` | BPMN 2.0 XML, such as `.bpmn` |
| `table` | a markdown table, such as `.md` |
| `image` | `.png`, `.jpg`, `.gif`, `.webp` or `.svg` |

A version is refused when an attachment has no id or repeats one, has an
unknown kind, names a file that is not in `attachments/`, has no title or
author, or is about a block that is not on the page.

## discussion.json

```json
{
  "source": "/path/to/the/source.md",
  "sourceHash": "…",
  "opened": "2026-10-13T08:00:00.000Z",
  "closed": null,
  "version": 1,
  "sessions": [{ "id": "…", "transcript": "…" }],
  "integrations": [{ "id": "i1", "kind": "local", "reference": "project:process", "label": "…" }],
  "annotations": [
    { "id": "…", "type": "comment", "target": "b3", "author": "me", "time": "…", "body": "…" }
  ]
}
```

- `sourceHash` is the SHA-256 of the source as it was copied; a source whose
  hash differs has changed since.
- `integrations` are what the discussion depends on outside its source, added
  with `topic integration add <source> <kind> <reference>`: `local`, a process
  of the process manager, named `project:process`; `cluster`, a deployment in a
  Kubernetes cluster; `jenkins`, a job. They survive every version and carry
  over when the discussion is refreshed. A `cluster` reference is
  `context/namespace/deployment`, asked read-only and only for the contexts
  `TOPIC_OVERVIEW_KUBE_CONTEXTS` lists. A `jenkins` reference is a build,
  `job#number`, or a job alone, meaning its last build; folders are written
  `folder/job`. A finished build is not asked again. The server is
  `TOPIC_OVERVIEW_JENKINS_URL`, asked as `TOPIC_OVERVIEW_JENKINS_USER`, with
  the token from the environment.
- `resolution` is set when the discussion is closed, saying why: `on-demand`
  when it was closed with `topic close`, `source-changed` when it was
  refreshed from its changed source, and `started-over` when a new discussion
  was opened on the same source while it was still open.

The annotations belong to the current version and start empty with every new
one. A comment is the only type of annotation so far.

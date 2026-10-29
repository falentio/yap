---
title: Star a GitHub repository — gh CLI vs GitHub MCP server
category: howto
tags: [github, gh-cli, mcp, github-mcp-server, stars]
status: complete
created: 2026-02-14
updated: 2026-02-14
sources:
  - https://github.com/github/github-mcp-server/blob/main/README.md
  - https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md
  - https://github.blog/changelog/2025-12-10-the-github-mcp-server-adds-support-for-tool-specific-configuration-and-more/
  - https://docs.github.com/rest/activity/starring
confidence: high
---

# Star a GitHub repository — gh CLI vs GitHub MCP server

## Goal

Star (or unstar) a repository two ways: from a shell with the GitHub CLI, and from an
agent through the official GitHub MCP server. Both end up in the same GitHub REST
endpoint, so pick by which surface you are already in, not by capability.

| | `gh` CLI | GitHub MCP server |
| --- | --- | --- |
| Star | `gh api --method PUT /user/starred/{owner}/{repo}` | `star_repository` |
| Unstar | `gh api --method DELETE /user/starred/{owner}/{repo}` | `unstar_repository` |
| List stars | `gh api /user/starred` | `list_starred_repositories` |
| Toolset | n/a | `stargazers` (not in `default`) |
| Read-only mode | n/a | blocked by `X-MCP-Readonly` / `GITHUB_READ_ONLY` |
| Token scope | `gh auth refresh -s repo` if needed | PAT or GitHub Copilot OAuth, `repo` scope |

## Prerequisites

- `gh` 2.102.0 authenticated (`gh auth status`). Verified on 2026-02-14 against the
  GitHub CLI installed locally.
- For MCP: the official server — remote at `https://api.githubcopilot.com/mcp/`, or the
  local binary/distroless image `ghcr.io/github/github-mcp-server` — plus a token that
  carries `repo` scope. The `star_repository`/`unstar_repository` tools declare
  `OAuth Challenge Scopes: repo`
  ([README](https://github.com/github/github-mcp-server/blob/main/README.md)).

## Steps

### gh CLI

`gh` has **no `gh repo star` subcommand**; `gh repo` covers create/list/clone/fork/
edit/delete/rename/archive/sync/view only. Use `gh api` against the starring endpoint
([REST docs](https://docs.github.com/rest/activity/starring)):

1. Star:
   ```bash
   gh api --method PUT /user/starred/OWNER/REPO
   ```
2. Unstar:
   ```bash
   gh api --method DELETE /user/starred/OWNER/REPO
   ```
3. Inside a clone, let `gh` fill the placeholders from the remote:
   ```bash
   gh api --method PUT /user/starred/{owner}/{repo}
   ```

### GitHub MCP server

1. Enable the `stargazers` toolset. It is **not** in the default set, which is
   `context, repos, issues, pull_requests, users`
   ([README](https://github.com/github/github-mcp-server/blob/main/README.md)):
   - local: `./github-mcp-server --toolsets default,stargazers` or
     `GITHUB_TOOLSETS="default,stargazers"`
   - remote: header `X-MCP-Toolsets: default,stargazers`, or point straight at the
     toolset URL `https://api.githubcopilot.com/mcp/x/stargazers`
     ([remote-server.md](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md))
2. Call the tool with `owner` and `repo` (both required strings):
   ```json
   { "owner": "github", "repo": "github-mcp-server" }
   ```
   Tool names: `star_repository`, `unstar_repository`,
   `list_starred_repositories` (the list tool also takes `username`, `page`,
   `perPage`, `sort`, `direction`).
3. Skip the toolset fan-out when you want only this: `X-MCP-Tools: star_repository`
   (or `GITHUB_TOOLS=star_repository` locally) selects individual tools instead of
   whole toolsets ([GitHub changelog, 2025-12-10](https://github.blog/changelog/2025-12-10-the-github-mcp-server-adds-support-for-tool-specific-configuration-and-more/)).

## Verification

- CLI: both verbs return **204 No Content**, so success is the exit code, not output.
  ```bash
  gh api --method PUT /user/starred/OWNER/REPO && echo starred
  gh api /user/starred/OWNER/REPO --silent && echo listed || echo not-starred
  ```
- Star count (unaffected by your own star, useful as a sanity read):
  `gh api /repos/OWNER/REPO --jq .stargazers_count`
- MCP: `list_starred_repositories` for the authenticated user should now include the
  repository.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `gh api` prints nothing, exit 0 | `PUT`/`DELETE` return 204 | Treat exit code as the result |
| 404 on star/unstar | Token lacks `repo` scope, or repo is private and unreadable | `gh auth refresh -s repo`; re-auth the MCP token |
| MCP has no `star_repository` | `stargazers` toolset not enabled | Add `stargazers` to toolsets, or name the tool in `X-MCP-Tools` |
| MCP rejects the write | Server running read-only (`X-MCP-Readonly`/`GITHUB_READ_ONLY`) | Drop read-only mode |
| Unknown toolset name silently ignored | Remote server ignores unknown toolsets without error | Enable per-tool via `X-MCP-Tools` to get a hard failure instead |

## Gotchas

- A **fine-grained PAT** does not hide tools it cannot use: the docs note classic-PAT
  scope filtering does not apply, so `star_repository` may appear and then fail.
- `X-MCP-Toolsets` fails **silently** on a typo; `X-MCP-Tools` fails loudly. Prefer the
  latter when the exact tool matters.
- Starring is per-user, not per-repo: the endpoint is `/user/starred/...`, so the
  authenticated identity decides whose star is written.

## Related

- [gh-cli skill reference](/home/kevin/.agents/skills/gh-cli/SKILL.md) — `gh` command surface, incl. `gh api` and star-based search.

## Changelog

- 2026-02-14 — created.

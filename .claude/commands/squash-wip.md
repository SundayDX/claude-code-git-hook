---
description: 合并多个 [AUTO-WIP] commits 为一个正式 commit
allowed-tools: Bash(git log:*), Bash(git reset:*), Bash(git commit:*), Bash(git stash:*)
argument-hint: [commit-message]
---

# Squash WIP 命令

合并从最近的非 [AUTO-WIP] commit 到 HEAD 的所有 [AUTO-WIP] commits 为一个正式 commit。

## 功能

- 自动扫描 Git 历史，识别所有连续的 [AUTO-WIP] commits
- 显示将要合并的 commits 预览
- 使用 `git reset --soft` 安全地合并 commits
- 生成包含所有操作摘要的正式 commit 消息

## 使用方法

执行 `/squash-wip` 将自动合并所有 [AUTO-WIP] commits。

如果需要自定义合并后的 commit 消息，可以使用：

```
/squash-wip 自定义的 commit 消息
```

其中 `$ARGUMENTS` 将替换为你提供的自定义消息。如果不提供参数，将自动生成合并消息。

## 执行步骤

1. 检查当前目录是否为 git 仓库
2. 查找基准点（最近的非 [AUTO-WIP] commit）
3. 收集所有 [AUTO-WIP] commits
4. 显示合并预览
5. 执行合并操作

执行以下命令来运行 squash-wip 工具：

```bash
node "$CLAUDE_PROJECT_DIR/src/splash.js" $ARGUMENTS
```

**重要说明**：
- 如果提供了 `$ARGUMENTS`（自定义 commit 消息），将使用该消息作为合并后的 commit 消息
- 如果不提供参数，工具会自动生成包含所有操作摘要的 commit 消息
- 命令会显示将要合并的 commits 预览，然后执行合并操作


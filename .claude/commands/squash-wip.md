# squash-wip

合并多个 [AUTO-WIP] commits 为一个正式 commit。

## 使用方法

```
/squash-wip [自定义消息]
```

## 说明

该命令会：
1. 查找从最后一个非 WIP commit 到 HEAD 之间的所有 [AUTO-WIP] commits
2. 使用 AI 自动生成合并后的 commit 消息（或使用您提供的自定义消息）
3. 将这些 commits 合并为一个正式 commit
4. 保留工作目录中的未提交变更

## 示例

- `/squash-wip` - 自动生成合并消息
- `/squash-wip 实现用户认证系统` - 使用自定义消息
- `/squash-wip 修复登录bug并优化性能` - 描述多个修改

## 执行命令

```bash
cc-git-hook squash-wip {args}
```

## 注意事项

- 确保已全局安装 `claude-code-git-hook` 包
- 该命令会修改 git 历史，请谨慎使用
- 如有未提交的变更，会被自动暂存和恢复
- 建议在合并前先使用 `git log` 查看要合并的 commits

## 相关命令

- `/help` - 查看所有可用命令
- 运行 `cc-git-hook doctor` - 诊断配置问题

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-04

### Added
- 初始版本发布
- 自动 WIP commit 功能：在 Claude Code 每轮对话结束时自动创建 `[AUTO-WIP]` commit
- `/squash-wip` slash 命令：合并多个 WIP commits 为正式 commit
- 智能 commit 消息生成：基于用户操作和文件变更自动生成有意义的消息
- 项目级和全局配置支持
- 完整的错误处理和日志系统

### Features
- 自动检测 git 仓库状态
- 安全的 git 操作（不会中断 Claude Code 流程）
- 支持自定义 commit 消息
- 详细的调试模式支持


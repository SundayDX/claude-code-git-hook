# 贡献指南

感谢你考虑为 Claude Code Git Hook Tool 做出贡献！

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议，请：

1. 检查 [Issues](https://github.com/SundayDX/claude-code-git-hook/issues) 中是否已有相关问题
2. 如果没有，创建一个新的 Issue，包含：
   - 清晰的问题描述
   - 复现步骤
   - 预期行为和实际行为
   - 环境信息（Node.js 版本、操作系统等）

### 提交代码

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 2 空格缩进
- 遵循现有的代码风格
- 添加适当的注释
- 确保代码通过 lint 检查

### 提交信息规范

提交信息应清晰描述更改内容：

```
feat: 添加配置文件支持
fix: 修复 git 命令执行错误
docs: 更新 README
refactor: 重构代码结构
```

### 测试

在提交 PR 前，请确保：

- 代码在本地测试通过
- 没有引入新的错误
- 更新了相关文档

## 开发环境设置

```bash
# 克隆项目
git clone https://github.com/SundayDX/claude-code-git-hook.git
cd claude-code-git-hook

# 安装依赖（如果有）
npm install

# 运行测试
npm test
```

## 许可证

通过贡献代码，你同意你的贡献将在 MIT 许可证下发布。


# Claude Code Git Hook Tool

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)

🤖 **自动化的 Git 版本管理工具，专为 Claude Code 设计**

一个强大的 Git Hook 工具，用于自动管理版本控制。工具会在每轮对话结束时自动创建 `[AUTO-WIP]` commit，并提供 `/squash-wip` slash 命令将多个 WIP commits 合并为正式 commit。

## ✨ 功能特性

- 🚀 **自动 WIP Commit**: 在 Claude Code 每轮对话结束时，自动创建 `[AUTO-WIP]` 开头的 commit，记录本次操作
- 🧠 **智能消息生成**: 基于用户操作和文件变更自动生成有意义的 commit 消息
- 🔀 **Squash WIP 命令**: 一键合并多个 `[AUTO-WIP]` commits 为正式 commit，便于提交到远程仓库
- 🛡️ **安全可靠**: 所有操作都有错误处理，不会中断 Claude Code 的正常工作流程
- ⚙️ **灵活配置**: 支持项目级和用户级配置文件
- 📊 **详细日志**: 支持调试模式和详细日志输出

## 🚀 快速开始

### 安装方法

#### 方法一：安装脚本（推荐，最简单）

使用一键安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/SundayDX/claude-code-git-hook/main/scripts/install.sh | bash
```

或者从本地项目安装：

```bash
# 克隆项目
git clone https://github.com/SundayDX/claude-code-git-hook.git
cd claude-code-git-hook

# 运行安装脚本
bash scripts/install.sh
```

安装后可以在任何目录使用：

```bash
cc-git-hook squash-wip [message]  # 合并 WIP commits
cc-git-hook auto-commit            # 手动运行 auto-commit
cc-git-hook doctor                 # 诊断工具，检查安装和配置状态
cc-git-hook version                # 显示版本号
cc-git-hook upgrade                # 检查并升级到最新版本
cc-git-hook help                   # 显示帮助信息
```

**安装位置说明**：
- 项目文件安装到：`~/.claude-code-git-hook/`（可通过环境变量 `CC_GIT_HOOK_INSTALL_ROOT` 自定义）
- 命令符号链接到：`~/.local/bin/cc-git-hook`（可通过环境变量 `CC_GIT_HOOK_BIN_DIR` 自定义）
- 安装后完全独立，不依赖原始源代码位置

#### 方法二：克隆项目（手动安装）

```bash
git clone https://github.com/SundayDX/claude-code-git-hook.git
cd claude-code-git-hook

# 运行安装脚本（推荐）
bash scripts/install.sh
```

或者手动复制安装：

```bash
# 1. 复制项目文件到用户目录
mkdir -p ~/.claude-code-git-hook
cp -r src ~/.claude-code-git-hook/
cp package.json ~/.claude-code-git-hook/

# 2. 创建命令符号链接到 PATH
mkdir -p ~/.local/bin
ln -s ~/.claude-code-git-hook/src/cc-git-hook.js ~/.local/bin/cc-git-hook

# 3. 确保 ~/.local/bin 在 PATH 中
export PATH="$HOME/.local/bin:$PATH"
# 将此行添加到 ~/.bashrc 或 ~/.zshrc 使其永久生效
```

#### 方法三：直接使用（无需安装）

如果项目已克隆，可以直接使用脚本：

```bash
# 使用统一入口
node src/cc-git-hook.js squash-wip
node src/cc-git-hook.js auto-commit
node src/cc-git-hook.js doctor

# 或直接使用模块（向后兼容）
node src/auto-commit.js
node src/splash.js
```

#### 方法四：NPX 方式（如果发布到 npm）

```bash
# 如果项目发布到 npm
npx claude-code-git-hook squash-wip
npx claude-code-git-hook auto-commit
```

### 配置和验证

安装完成后，运行诊断工具检查配置状态：

```bash
cc-git-hook doctor
```

Doctor 命令会自动检查：
- ✅ Node.js 和 Git 版本
- ✅ 命令是否已正确安装到 PATH
- ✅ 全局 Hook 配置是否正确
- ✅ 工具配置文件状态
- ✅ 提供修复建议（如果有问题）

**首次配置**：

安装脚本会自动配置全局 Hook。如果你需要手动配置或使用项目级配置，Doctor 会提供详细的配置说明和修复建议。

**升级安装**：

如果有新版本，可以使用以下方式升级：

```bash
# 方法一：使用 upgrade 命令（如果已安装）
cc-git-hook upgrade

# 方法二：重新运行安装脚本（推荐）
# 从 GitHub 获取最新版本
curl -fsSL https://raw.githubusercontent.com/SundayDX/claude-code-git-hook/main/scripts/install.sh | bash

# 或从本地项目更新
cd claude-code-git-hook
git pull
bash scripts/install.sh
```

安装脚本会自动更新 `~/.claude-code-git-hook/` 目录中的文件。

**Squash WIP 命令**：

项目已包含 `.claude/commands/squash-wip.md` 文件，这会在 Claude Code 中自动注册 `/squash-wip` slash 命令。

**验证安装**：
- 运行 `cc-git-hook doctor` 检查所有配置
- 在 Claude Code 中输入 `/help`，你应该能看到 `squash-wip` 命令列在自定义命令中

**可选配置**：

如果需要自定义工具行为，可以创建配置文件（Doctor 会检查配置文件的格式）：

- **项目级配置**：`.claude-git-hook.json`
- **用户级配置**：`~/.claude-git-hook.json`

配置文件示例请参考 `examples/claude-git-hook-config.example.json`。配置文件优先级：项目级 > 用户级 > 默认配置。

## 📖 使用方法

### 自动 WIP Commit

配置完成后，Claude Code 会在每轮对话结束时自动：

1. ✅ 检查是否有未提交的变更
2. ✅ 如果有变更，自动暂存所有文件
3. ✅ 创建 `[AUTO-WIP]` commit，消息格式为：`[AUTO-WIP] <操作描述>: <文件变更摘要>`

**示例 commit 消息**:
```
[AUTO-WIP] 实现用户登录功能 (修改了 3 个文件，新增了 1 个文件)
[AUTO-WIP] 优化数据库查询性能 (修改了 2 个文件)
[AUTO-WIP] 自动保存 2024/01/15 14:30 (修改了 5 个文件)
```

### Squash WIP 命令

当你完成一系列工作后，可以使用 `/squash-wip` slash 命令将多个 `[AUTO-WIP]` commits 合并为一个正式 commit：

**在 Claude Code 中使用**：
```
/squash-wip
```

如果需要自定义合并后的 commit 消息：
```
/squash-wip 实现用户认证系统
```

**命令行方式**（可选）：
```bash
# 使用统一入口
cc-git-hook squash-wip

# 或带自定义消息
cc-git-hook squash-wip "自定义的 commit 消息"

# 或直接使用模块（向后兼容）
node src/splash.js "自定义的 commit 消息"
```

**Squash WIP 命令会**:

1. 🔍 扫描从最近的非 `[AUTO-WIP]` commit 到 HEAD 的所有 commits
2. 📋 识别所有 `[AUTO-WIP]` commits
3. 👁️ 显示将要合并的 commits 预览
4. 🔀 自动合并这些 commits 为一个正式 commit
5. ✍️ 生成包含所有操作摘要的 commit 消息

**示例合并后的 commit 消息**:
```
实现用户认证系统

包含以下修改:
- 添加用户登录功能
- 实现密码加密
- 添加 JWT token 验证
```

## 📋 使用示例

### 基本工作流

```bash
# 1. 在 Claude Code 中进行开发工作
# Claude Code 会自动创建 [AUTO-WIP] commits

# 2. 完成一个功能后，使用 squash-wip 合并
/squash-wip 实现用户认证功能

# 3. 推送到远程仓库
git push
```

### 自定义配置

```bash
# 启用调试模式
DEBUG=1 node src/auto-commit.js

# 使用自定义 commit 前缀（通过环境变量）
CLAUDE_GIT_HOOK_PREFIX="[WIP]" node src/auto-commit.js
```

## ⚙️ 配置选项

详细的配置选项说明请参考 `examples/claude-git-hook-config.example.json` 文件。

主要配置选项包括：
- **autoCommit**: 自动 commit 相关配置（启用、前缀、消息长度等）
- **squashWip**: Squash WIP 命令相关配置（自动生成消息、显示预览等）
- **git**: Git 操作配置（自动暂存、安全模式等）
- **debug**: 调试模式配置

**环境变量**：
- `DEBUG` 或 `CLAUDE_GIT_HOOK_DEBUG`: 启用调试模式
- `CLAUDE_GIT_HOOK_AUTO_COMMIT`: 启用/禁用自动 commit
- `CLAUDE_GIT_HOOK_PREFIX`: 自定义 commit 前缀

运行 `cc-git-hook doctor` 可以检查当前配置状态并获取配置帮助。

## 🔧 工作原理

### 自动 Commit Hook

- **触发时机**: Claude Code 的 `Stop` 事件（每轮对话结束时）
- **Hook 输入**: Claude Code 通过 stdin 传递 JSON 格式的 hook 输入，包含用户 prompt 等信息
- **消息生成**: 
  - 从 hook 输入的 `prompt` 字段提取用户操作意图
  - 分析 `git diff` 获取文件变更摘要
  - 生成格式化的 commit 消息

### Squash WIP 命令

- **触发方式**: 通过 Claude Code 的 slash 命令系统（`/squash-wip`）
- **执行机制**: 调用 `src/splash.js` 脚本，可以通过参数传递自定义 commit 消息
- **扫描策略**: 从 HEAD 向前查找，找到第一个非 `[AUTO-WIP]` commit 作为基准点
- **合并方法**: 使用 `git reset --soft` 将多个 commits 合并为一个
- **消息生成**: 如果提供了参数，使用参数作为消息；否则提取所有 WIP commits 的描述，生成综合的 commit 消息

## 🐛 故障排除

### 使用 Doctor 命令诊断问题

**首先运行诊断工具**：

```bash
cc-git-hook doctor
```

Doctor 会检查所有配置并提供详细的修复建议。大多数配置问题都可以通过 Doctor 命令解决。

### 常见问题

**Hook 没有执行**：
- 运行 `cc-git-hook doctor` 检查配置
- 在 Claude Code 中使用 `/hooks` 命令检查 hook 是否已注册
- 使用 `claude --debug` 查看详细的 hook 执行日志

**Commit 消息不准确**：
- Hook 会尝试从用户 prompt 中提取操作描述
- 如果无法提取，会使用时间戳作为后备
- 可以通过设置 `DEBUG=1` 查看详细的处理过程

**Squash WIP 命令失败**：
- 确保当前在 git 仓库中
- 确保有未合并的 `[AUTO-WIP]` commits
- 检查是否有未提交的变更（squash-wip 会暂存它们）
- 如果遇到冲突，可能需要手动解决

## 🔒 安全注意事项

- ⚠️ Hook 脚本会执行 git 操作，请确保在受信任的项目中使用
- ✅ 所有 git 操作都有错误处理，不会影响 Claude Code 的正常运行
- ✅ 建议在测试项目中先验证配置是否正确
- ✅ 定期检查自动创建的 commits，确保符合预期

## 💡 最佳实践

1. **定期使用 Squash WIP**: 完成一个功能或任务后，及时使用 `/squash-wip` 命令整理 commits
2. **审查 Commit 消息**: Squash WIP 生成的 commit 消息可以手动编辑，确保清晰描述所做的工作
3. **项目级配置**: 建议使用项目级配置（`.claude/settings.json`），这样团队成员可以共享配置
4. **版本控制**: 将 `.claude/settings.json` 和 `.claude/commands/` 提交到版本控制，但不要提交 `.claude/settings.local.json`
5. **配置文件管理**: 将 `.claude-git-hook.json` 添加到 `.gitignore`，使用 `.claude-git-hook.example.json` 作为模板

## 📁 项目结构

```
claude-code-git-hook/
├── .claude/
│   └── commands/
│       └── squash-wip.md      # Squash WIP slash 命令定义
├── src/
│   ├── auto-commit.js        # 自动 commit hook 脚本
│   ├── splash.js            # squash-wip 命令工具（内部实现）
│   ├── git-utils.js         # Git 操作工具函数
│   └── config.js            # 配置文件管理
├── examples/
│   ├── claude-settings.json           # Hook 配置示例
│   └── claude-git-hook-config.json   # 工具配置示例
├── scripts/
│   ├── install.sh                    # 一键安装脚本
│   └── run-once.sh                   # 一次性运行脚本
├── package.json
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── .gitignore
```

## 📦 安装验证

安装完成后，运行诊断工具验证安装：

```bash
cc-git-hook doctor
```

Doctor 命令会自动检查所有配置并提供修复建议。这是验证安装和配置的最简单方法。

**安装验证清单**：
- ✅ 项目文件已复制到 `~/.claude-code-git-hook/`
- ✅ 命令符号链接已创建到 `~/.local/bin/cc-git-hook`
- ✅ 命令目录在 PATH 中（如果不在，脚本会提示如何添加）
- ✅ 全局 Hook 配置已设置（`~/.claude/settings.json`）

**更新安装**：
如果需要更新到新版本，只需重新运行安装脚本：
```bash
bash scripts/install.sh
```
脚本会自动覆盖旧的安装文件。

### 卸载

如果需要卸载：

```bash
# 1. 删除命令符号链接
rm ~/.local/bin/cc-git-hook
# 或如果安装在 /usr/local/bin
# sudo rm /usr/local/bin/cc-git-hook

# 2. 删除安装目录（包含所有项目文件）
rm -rf ~/.claude-code-git-hook

# 3. 可选：删除全局 Hook 配置
rm ~/.claude/settings.json
```

**注意**：如果通过环境变量自定义了安装目录，请删除对应的目录：
- `CC_GIT_HOOK_INSTALL_ROOT` 指定的安装目录
- `CC_GIT_HOOK_BIN_DIR` 中创建的符号链接

## 📋 系统要求

- **Node.js**: >= 14.0.0
- **Git**: 任何现代版本
- **Claude Code**: 支持 hooks 和 slash commands 的版本

## 🧪 测试与验证

### 验证安装

运行验证脚本检查所有配置：

```bash
bash scripts/verify.sh
```

验证脚本会检查：
- ✅ Node.js 和 Git 版本
- ✅ 所有必要文件是否存在
- ✅ 文件权限是否正确
- ✅ 脚本语法是否正确
- ✅ 全局安装状态（如果已安装）

### 功能测试

在测试项目中：

1. 配置 hook
2. 在 Claude Code 中进行一些操作
3. 检查是否自动创建了 `[AUTO-WIP]` commits
4. 运行 `/squash-wip` 命令测试合并功能

### 调试模式

启用调试模式查看详细信息：

```bash
# 设置环境变量
export DEBUG=1

# 或使用配置文件
# 在 .claude-git-hook.json 中设置 "debug.enabled": true
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

贡献指南：
1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📚 相关资源

- [Claude Code Hooks 文档](https://docs.claude.com/en/docs/claude-code/hooks)
- [Claude Code Slash Commands 文档](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [Git 文档](https://git-scm.com/doc)

## 📝 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)

### v1.0.0

- ✅ 初始版本发布
- ✅ 支持自动 WIP commit
- ✅ 支持 `/squash-wip` slash 命令合并 commits
- ✅ 配置文件支持
- ✅ 完整的错误处理和日志系统

---

**Made with ❤️ for the Claude Code community**

如有问题或建议，欢迎提交 [Issue](https://github.com/SundayDX/claude-code-git-hook/issues) 或 [Pull Request](https://github.com/SundayDX/claude-code-git-hook/pulls)！

#!/bin/bash

# Claude Code Git Hook Tool 安装脚本
# 将工具安装到全局 PATH

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 检测安装目录
if [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
elif [ -w "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
    INSTALL_DIR="$HOME/.local/bin"
else
    INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
    mkdir -p "$INSTALL_DIR"
fi

echo "🚀 安装 Claude Code Git Hook Tool..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js (>= 14.0.0)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ 错误: 需要 Node.js >= 14.0.0，当前版本: $(node -v)"
    exit 1
fi

# 创建符号链接
echo "📦 创建符号链接..."

# 确保脚本有执行权限
chmod +x "$PROJECT_DIR/src/cc-git-hook.js"
# 其他模块也设置执行权限（用于向后兼容的直接调用）
chmod +x "$PROJECT_DIR/src/auto-commit.js"
chmod +x "$PROJECT_DIR/src/splash.js"
chmod +x "$PROJECT_DIR/src/doctor.js"
chmod +x "$PROJECT_DIR/src/version.js"
chmod +x "$PROJECT_DIR/src/upgrade.js"

# 创建统一入口的符号链接
# 注意：现在所有功能都通过 cc-git-hook 统一入口访问
# 各模块仍可单独运行（向后兼容），但推荐使用统一入口
echo "安装到: $INSTALL_DIR"

if [ -w "$INSTALL_DIR" ]; then
    ln -sf "$PROJECT_DIR/src/cc-git-hook.js" "$INSTALL_DIR/cc-git-hook"
else
    echo "需要 sudo 权限来安装到 $INSTALL_DIR"
    sudo ln -sf "$PROJECT_DIR/src/cc-git-hook.js" "$INSTALL_DIR/cc-git-hook"
fi

# 如果使用 ~/.local/bin，提示添加到 PATH
if [ "$INSTALL_DIR" = "$HOME/.local/bin" ]; then
    echo ""
    echo "⚠️  注意: 工具已安装到 ~/.local/bin"
    echo "请确保 ~/.local/bin 在你的 PATH 中："
    echo ""
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "将上面的命令添加到 ~/.bashrc 或 ~/.zshrc 中使其永久生效。"
fi

# 配置全局 Hook
echo ""
echo "⚙️  配置全局 Claude Code Hook..."

CLAUDE_DIR="$HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"
HOOK_CONFIG='{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cc-git-hook auto-commit",
            "timeout": 30
          }
        ]
      }
    ]
  }
}'

# 创建 .claude 目录
mkdir -p "$CLAUDE_DIR"

# 检查配置文件是否存在
if [ -f "$CLAUDE_SETTINGS" ]; then
    # 检查是否已包含 hook 配置（支持新旧格式）
    if grep -q "cc-git-hook auto-commit" "$CLAUDE_SETTINGS" 2>/dev/null || \
       grep -q "claude-code auto-commit" "$CLAUDE_SETTINGS" 2>/dev/null || \
       grep -q "claude-code-auto-commit" "$CLAUDE_SETTINGS" 2>/dev/null; then
        echo "✅ 全局 Hook 配置已存在"
    else
        echo "⚠️  全局 Hook 配置已存在，但未包含 cc-git-hook auto-commit"
        echo "   请手动编辑 $CLAUDE_SETTINGS 添加 hook 配置"
        echo "   或备份现有配置后运行安装脚本"
    fi
else
    # 创建新的配置文件
    echo "$HOOK_CONFIG" > "$CLAUDE_SETTINGS"
    echo "✅ 已创建全局 Hook 配置: $CLAUDE_SETTINGS"
fi

echo "✅ 安装完成！"
echo ""
echo "现在可以使用以下命令："
echo "  cc-git-hook squash-wip [message]  # 合并 WIP commits"
echo "  cc-git-hook auto-commit            # 手动运行 auto-commit（通常由 hook 自动调用）"
echo "  cc-git-hook doctor                 # 诊断工具，检查安装和配置状态"
echo "  cc-git-hook version                # 显示版本号"
echo "  cc-git-hook upgrade                # 检查并升级到最新版本"
echo "  cc-git-hook help                   # 显示帮助信息"
echo ""
echo "📝 下一步："
echo "1. 运行 cc-git-hook doctor 检查安装状态"
echo "2. 在项目中使用 /squash-wip 命令"


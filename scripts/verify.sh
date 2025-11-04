#!/bin/bash

# 验证安装脚本
# 检查所有必要的文件和配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 验证 Claude Code Git Hook Tool 安装..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js: $NODE_VERSION"

# 检查 Git
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 未找到 Git"
    exit 1
fi

GIT_VERSION=$(git --version)
echo "✅ $GIT_VERSION"

# 检查必要文件
echo ""
echo "📁 检查项目文件..."

files=(
    "src/auto-commit.js"
    "src/splash.js"
    "src/git-utils.js"
    "src/config.js"
    ".claude/commands/squash-wip.md"
    "examples/claude-settings.json"
)

for file in "${files[@]}"; do
    if [ -f "$PROJECT_DIR/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ 缺失: $file"
        exit 1
    fi
done

# 检查文件权限
echo ""
echo "🔐 检查文件权限..."

if [ -x "$PROJECT_DIR/src/auto-commit.js" ]; then
    echo "✅ src/auto-commit.js 有执行权限"
else
    echo "⚠️  src/auto-commit.js 缺少执行权限"
    chmod +x "$PROJECT_DIR/src/auto-commit.js"
    echo "✅ 已修复"
fi

if [ -x "$PROJECT_DIR/src/splash.js" ]; then
    echo "✅ src/splash.js 有执行权限"
else
    echo "⚠️  src/splash.js 缺少执行权限"
    chmod +x "$PROJECT_DIR/src/splash.js"
    echo "✅ 已修复"
fi

# 检查安装
echo ""
echo "🔧 检查全局安装..."

if command -v claude-code-squash-wip &> /dev/null; then
    echo "✅ claude-code-squash-wip 已安装"
    which claude-code-squash-wip
else
    echo "ℹ️  claude-code-squash-wip 未安装（可选）"
fi

if command -v claude-code-auto-commit &> /dev/null; then
    echo "✅ claude-code-auto-commit 已安装"
    which claude-code-auto-commit
else
    echo "ℹ️  claude-code-auto-commit 未安装（可选）"
fi

# 测试脚本语法
echo ""
echo "🧪 测试脚本语法..."

if node --check "$PROJECT_DIR/src/auto-commit.js" 2>/dev/null; then
    echo "✅ src/auto-commit.js 语法正确"
else
    echo "❌ src/auto-commit.js 语法错误"
    exit 1
fi

if node --check "$PROJECT_DIR/src/splash.js" 2>/dev/null; then
    echo "✅ src/splash.js 语法正确"
else
    echo "❌ src/splash.js 语法错误"
    exit 1
fi

if node --check "$PROJECT_DIR/src/config.js" 2>/dev/null; then
    echo "✅ src/config.js 语法正确"
else
    echo "❌ src/config.js 语法错误"
    exit 1
fi

echo ""
echo "✅ 验证完成！所有检查通过。"
echo ""
echo "📝 下一步："
echo "1. 配置 Claude Code hook（见 README.md）"
echo "2. 在项目中使用 /squash-wip 命令"


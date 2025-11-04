#!/bin/bash

# 一次性运行脚本（无需安装）
# 直接从 GitHub 或本地项目运行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js (>= 14.0.0)"
    exit 1
fi

echo "🚀 运行 Claude Code Git Hook Tool..."
echo ""

# 显示使用选项
echo "请选择要运行的工具："
echo "1) squash-wip - 合并 WIP commits"
echo "2) auto-commit - 手动运行 auto-commit"
echo ""
read -p "请输入选项 (1 或 2): " choice

case $choice in
    1)
        node "$PROJECT_DIR/src/splash.js" "$@"
        ;;
    2)
        node "$PROJECT_DIR/src/auto-commit.js" "$@"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac


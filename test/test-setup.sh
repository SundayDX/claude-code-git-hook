#!/bin/bash

# 测试环境设置脚本
# 创建一个临时的 git 仓库用于测试

set -e

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$TEST_DIR/.." && pwd)"
TEST_REPO_DIR="$TEST_DIR/test-repo"

echo "🧪 设置测试环境..."

# 清理旧的测试仓库
if [ -d "$TEST_REPO_DIR" ]; then
    echo "清理旧的测试仓库..."
    rm -rf "$TEST_REPO_DIR"
fi

# 创建测试仓库
mkdir -p "$TEST_REPO_DIR"
cd "$TEST_REPO_DIR"

# 初始化 git 仓库
git init
git config user.name "Test User"
git config user.email "test@example.com"

# 创建初始文件
echo "# Test Project" > README.md
git add README.md
git commit -m "Initial commit"

echo "✅ 测试环境已创建: $TEST_REPO_DIR"
echo ""
echo "现在可以运行测试："
echo "  cd $TEST_REPO_DIR"
echo "  node $PROJECT_DIR/src/auto-commit.js"


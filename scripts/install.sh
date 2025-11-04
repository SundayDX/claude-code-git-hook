#!/bin/bash

# Claude Code Git Hook Tool 安装脚本
# 将工具安装到用户本地 PATH 目录

set -e

# ============================================================================
# 路径解析：获取脚本和项目目录
# ============================================================================

# 获取脚本所在目录的绝对路径
# 使用 ${BASH_SOURCE[0]} 是最可靠的方式（在 bash 中）
# 如果不可用，回退到 $0
if [ -n "${BASH_SOURCE[0]}" ]; then
    # bash 中推荐使用 BASH_SOURCE
    SCRIPT_FILE="${BASH_SOURCE[0]}"
else
    # 其他 shell 使用 $0
    SCRIPT_FILE="$0"
fi

# 将脚本路径转换为绝对路径
# 如果已经是绝对路径，直接使用；如果是相对路径，转换为绝对路径
if [ "${SCRIPT_FILE#/}" = "$SCRIPT_FILE" ]; then
    # 相对路径：基于当前工作目录转换
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_FILE")" && pwd)"
    SCRIPT_FILE="$SCRIPT_DIR/$(basename "$SCRIPT_FILE")"
else
    # 已经是绝对路径
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_FILE")" && pwd)"
fi

# 处理符号链接（如果脚本本身是符号链接）
# macOS 的 readlink 不支持 -f，所以使用循环处理
if [ -L "$SCRIPT_FILE" ]; then
    # 解析符号链接
    while [ -L "$SCRIPT_FILE" ]; do
        LINK_TARGET="$(readlink "$SCRIPT_FILE" 2>/dev/null || echo "$SCRIPT_FILE")"
        if [ "${LINK_TARGET#/}" = "$LINK_TARGET" ]; then
            # 相对路径的符号链接，需要基于链接所在目录解析
            SCRIPT_FILE="$(cd "$SCRIPT_DIR" && pwd)/$LINK_TARGET"
        else
            # 绝对路径的符号链接
            SCRIPT_FILE="$LINK_TARGET"
        fi
        SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_FILE")" && pwd)"
    done
fi

# 项目根目录是 scripts 目录的父目录
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 验证项目目录是否正确
if [ ! -f "$PROJECT_DIR/src/cc-git-hook.js" ]; then
    echo "❌ 错误: 无法找到项目文件 $PROJECT_DIR/src/cc-git-hook.js"
    echo "   当前检测到的项目目录: $PROJECT_DIR"
    echo "   脚本目录: $SCRIPT_DIR"
    exit 1
fi

# ============================================================================
# 安装目录选择
# ============================================================================

# 安装目录结构：
# - INSTALL_ROOT: 项目文件安装位置（~/.claude-code-git-hook/）
# - BIN_DIR: 命令符号链接位置（~/.local/bin 或 ~/bin）

# 项目安装根目录（存储实际文件）
if [ -n "$CC_GIT_HOOK_INSTALL_ROOT" ]; then
    # 用户通过环境变量指定了安装根目录
    INSTALL_ROOT="$CC_GIT_HOOK_INSTALL_ROOT"
else
    # 默认安装到用户主目录下的隐藏目录
    INSTALL_ROOT="$HOME/.claude-code-git-hook"
fi

# 命令符号链接目录（PATH 中的目录）
if [ -n "$CC_GIT_HOOK_BIN_DIR" ]; then
    # 用户通过环境变量指定了 bin 目录
    BIN_DIR="$CC_GIT_HOOK_BIN_DIR"
elif [ -w "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
    # 默认使用用户本地 bin 目录（推荐，符合 XDG Base Directory 规范）
    BIN_DIR="$HOME/.local/bin"
else
    # 回退方案：使用用户主目录下的 bin 目录
    BIN_DIR="$HOME/bin"
fi

# 确保目录可写
if ! mkdir -p "$INSTALL_ROOT" 2>/dev/null; then
    echo "❌ 错误: 无法创建安装目录: $INSTALL_ROOT"
    exit 1
fi

if [ ! -w "$INSTALL_ROOT" ]; then
    echo "❌ 错误: 安装目录不可写: $INSTALL_ROOT"
    exit 1
fi

if ! mkdir -p "$BIN_DIR" 2>/dev/null; then
    echo "❌ 错误: 无法创建 bin 目录: $BIN_DIR"
    exit 1
fi

# ============================================================================
# 开始安装
# ============================================================================

echo "🚀 安装 Claude Code Git Hook Tool..."
echo "   源代码目录: $PROJECT_DIR"
echo "   安装目录: $INSTALL_ROOT"
echo "   命令链接: $BIN_DIR/cc-git-hook"
echo ""

# ============================================================================
# 检查依赖
# ============================================================================

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js (>= 14.0.0)"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ 错误: 需要 Node.js >= 14.0.0，当前版本: $(node -v)"
    exit 1
fi

# ============================================================================
# 复制项目文件到安装目录
# ============================================================================

echo "📦 复制项目文件到安装目录..."

# 需要复制的文件和目录
INSTALL_SRC_DIR="$INSTALL_ROOT/src"

# 如果安装目录已存在，询问是否覆盖
if [ -d "$INSTALL_ROOT" ] && [ "$(ls -A "$INSTALL_ROOT" 2>/dev/null)" ]; then
    echo "⚠️  检测到已存在的安装: $INSTALL_ROOT"
    echo "   将更新到新版本..."
fi

# 复制 src 目录（包含所有源代码）
echo "   复制 src 目录..."
if [ -d "$INSTALL_SRC_DIR" ]; then
    rm -rf "$INSTALL_SRC_DIR"
fi
mkdir -p "$INSTALL_SRC_DIR"
cp -r "$PROJECT_DIR/src"/* "$INSTALL_SRC_DIR/"

# 复制 package.json（如果需要读取版本信息等）
if [ -f "$PROJECT_DIR/package.json" ]; then
    cp "$PROJECT_DIR/package.json" "$INSTALL_ROOT/"
fi

# 设置文件执行权限
echo "   设置文件权限..."
chmod +x "$INSTALL_SRC_DIR/cc-git-hook.js"
chmod +x "$INSTALL_SRC_DIR/auto-commit.js"
chmod +x "$INSTALL_SRC_DIR/splash.js"
chmod +x "$INSTALL_SRC_DIR/doctor.js"
chmod +x "$INSTALL_SRC_DIR/version.js"
chmod +x "$INSTALL_SRC_DIR/upgrade.js"

echo "✅ 文件复制完成"

# ============================================================================
# 创建命令符号链接
# ============================================================================

echo "🔗 创建命令符号链接..."

# 检查 bin 目录是否可写
if [ ! -w "$BIN_DIR" ]; then
    echo "❌ 错误: bin 目录不可写: $BIN_DIR"
    echo "   请检查目录权限或使用环境变量 CC_GIT_HOOK_BIN_DIR 指定其他目录"
    exit 1
fi

# 创建或更新符号链接
INSTALLED_SCRIPT="$INSTALL_SRC_DIR/cc-git-hook.js"

if [ -L "$BIN_DIR/cc-git-hook" ]; then
    CURRENT_TARGET="$(readlink "$BIN_DIR/cc-git-hook" 2>/dev/null || echo "")"
    if [ "$CURRENT_TARGET" = "$INSTALLED_SCRIPT" ]; then
        echo "✅ 符号链接已存在且指向正确位置"
    else
        echo "⚠️  更新符号链接..."
        ln -sf "$INSTALLED_SCRIPT" "$BIN_DIR/cc-git-hook"
        echo "✅ 已更新符号链接: $BIN_DIR/cc-git-hook -> $INSTALLED_SCRIPT"
    fi
else
    # 创建新的符号链接
    ln -sf "$INSTALLED_SCRIPT" "$BIN_DIR/cc-git-hook"
    echo "✅ 已创建符号链接: $BIN_DIR/cc-git-hook -> $INSTALLED_SCRIPT"
fi

# ============================================================================
# 检查 PATH 配置
# ============================================================================

# 检查 bin 目录是否在 PATH 中
# 使用精确匹配，避免部分路径匹配问题
if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
    echo ""
    echo "⚠️  注意: 命令目录 $BIN_DIR 不在你的 PATH 中"
    echo ""
    echo "请将以下命令添加到你的 shell 配置文件中："
    echo ""
    
    # 检测 shell 类型并给出相应的配置建议
    SHELL_RC=""
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="~/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        SHELL_RC="~/.bashrc"
    else
        SHELL_RC="~/.bashrc 或 ~/.zshrc"
    fi
    
    if [ "$BIN_DIR" = "$HOME/.local/bin" ]; then
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    elif [ "$BIN_DIR" = "$HOME/bin" ]; then
        echo "  export PATH=\"\$HOME/bin:\$PATH\""
    else
        echo "  export PATH=\"$BIN_DIR:\$PATH\""
    fi
    echo ""
    echo "添加到配置文件: $SHELL_RC"
    echo ""
    echo "然后运行以下命令使配置生效："
    if [ -n "$ZSH_VERSION" ]; then
        echo "  source ~/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        echo "  source ~/.bashrc"
    else
        echo "  source $SHELL_RC"
    fi
    echo ""
    echo "或者临时添加到当前会话："
    if [ "$BIN_DIR" = "$HOME/.local/bin" ]; then
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    elif [ "$BIN_DIR" = "$HOME/bin" ]; then
        echo "  export PATH=\"\$HOME/bin:\$PATH\""
    else
        echo "  export PATH=\"$BIN_DIR:\$PATH\""
    fi
else
    echo "✅ 命令目录已在 PATH 中"
fi

# ============================================================================
# 配置全局 Hook
# ============================================================================

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

# ============================================================================
# 安装完成
# ============================================================================

echo ""
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
echo ""

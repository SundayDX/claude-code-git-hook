#!/bin/bash

# Claude Code Git Hook Tool 安装脚本
# 将工具安装到用户本地 PATH 目录

set -e

# ============================================================================
# 安装目录选择
# ============================================================================

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
# 检查并更新项目目录
# ============================================================================

echo "🚀 安装 Claude Code Git Hook Tool..."
echo "   安装目录: $INSTALL_ROOT"
echo "   命令链接: $BIN_DIR/cc-git-hook"
echo ""

# 检查 git 是否可用
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 需要 Git 才能安装此工具"
    echo "   请先安装 Git"
    exit 1
fi

# 检查安装目录是否存在且是 git 仓库
if [ -d "$INSTALL_ROOT/.git" ]; then
    # 已存在 git 仓库，更新它
    echo "📥 检测到已存在的安装，正在更新..."
    cd "$INSTALL_ROOT"
    if ! git pull --quiet 2>/dev/null; then
        echo "⚠️  更新失败，尝试重新克隆..."
        cd "$(dirname "$INSTALL_ROOT")"
        rm -rf "$INSTALL_ROOT"
        git clone --depth 1 https://github.com/SundayDX/claude-code-git-hook.git "$INSTALL_ROOT"
        echo "✅ 重新克隆完成"
    else
        echo "✅ 更新完成"
    fi
elif [ -d "$INSTALL_ROOT" ] && [ "$(ls -A "$INSTALL_ROOT" 2>/dev/null)" ]; then
    # 目录存在但不是 git 仓库，重新克隆
    echo "⚠️  安装目录已存在但不是 git 仓库，正在重新克隆..."
    cd "$(dirname "$INSTALL_ROOT")"
    rm -rf "$INSTALL_ROOT"
    git clone --depth 1 https://github.com/SundayDX/claude-code-git-hook.git "$INSTALL_ROOT"
    echo "✅ 克隆完成"
else
    # 目录不存在，克隆仓库
    echo "📥 正在下载项目..."
    cd "$(dirname "$INSTALL_ROOT")"
    if ! git clone --depth 1 https://github.com/SundayDX/claude-code-git-hook.git "$INSTALL_ROOT" 2>/dev/null; then
        echo "❌ 错误: 无法克隆仓库"
        echo "   请检查网络连接或稍后重试"
        exit 1
    fi
    echo "✅ 下载完成"
fi

echo ""

# 验证项目目录是否正确
if [ ! -f "$INSTALL_ROOT/src/cc-git-hook.js" ]; then
    echo "❌ 错误: 无法找到项目文件 $INSTALL_ROOT/src/cc-git-hook.js"
    exit 1
fi

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
# 设置文件执行权限
# ============================================================================

echo "⚙️  设置文件权限..."

INSTALL_SRC_DIR="$INSTALL_ROOT/src"

chmod +x "$INSTALL_SRC_DIR/cc-git-hook.js"
chmod +x "$INSTALL_SRC_DIR/auto-commit.js"
chmod +x "$INSTALL_SRC_DIR/splash.js"
chmod +x "$INSTALL_SRC_DIR/doctor.js"
chmod +x "$INSTALL_SRC_DIR/version.js"
chmod +x "$INSTALL_SRC_DIR/upgrade.js"

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

# 使用 Node.js 解析和合并 JSON 配置
# 这个脚本会：
# 1. 读取现有配置文件（如果存在）
# 2. 解析 JSON
# 3. 检查是否已有 hook 配置
# 4. 如果没有，则合并添加；如果解析失败，则创建新配置

# 设置环境变量供 Node.js 脚本使用
export CLAUDE_SETTINGS_PATH="$CLAUDE_SETTINGS"
node << 'EOF'
const fs = require('fs');
const path = require('path');

const settingsPath = process.env.CLAUDE_SETTINGS_PATH;
const hookConfig = {
  hooks: {
    Stop: [
      {
        hooks: [
          {
            type: 'command',
            command: 'cc-git-hook auto-commit',
            timeout: 30
          }
        ]
      }
    ]
  }
};

let config = {};
let fileExists = false;

// 尝试读取现有配置
if (fs.existsSync(settingsPath)) {
  fileExists = true;
  try {
    const content = fs.readFileSync(settingsPath, 'utf8').trim();
    if (content) {
      config = JSON.parse(content);
    }
  } catch (error) {
    // JSON 解析失败，使用空配置
    console.log('⚠️  配置文件格式错误，将重新创建');
    config = {};
  }
}

// 检查是否已有 hook 配置
const hasHook = config.hooks && 
                config.hooks.Stop && 
                Array.isArray(config.hooks.Stop) &&
                config.hooks.Stop.length > 0 &&
                config.hooks.Stop[0].hooks &&
                config.hooks.Stop[0].hooks.some(hook => 
                  hook.command && hook.command.includes('cc-git-hook auto-commit')
                );

if (hasHook) {
  console.log('✅ 全局 Hook 配置已存在');
} else {
  // 合并配置：保留现有配置，添加 hook 配置
  if (!config.hooks) {
    config.hooks = {};
  }
  config.hooks.Stop = hookConfig.hooks.Stop;
  
  // 写入配置
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  
  if (fileExists) {
    console.log('✅ 已更新全局 Hook 配置:', settingsPath);
  } else {
    console.log('✅ 已创建全局 Hook 配置:', settingsPath);
  }
}
EOF

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

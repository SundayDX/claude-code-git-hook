#!/bin/bash

# Claude Code Git Hook Tool 安装脚本
# 使用 npm 全局安装

set -e

echo "🚀 安装 Claude Code Git Hook Tool..."
echo ""

# ============================================================================
# 清理旧的安装
# ============================================================================

echo "🔍 检查旧的安装..."

# 检查并删除可能存在的旧符号链接
OLD_LINKS=(
    "$HOME/.local/bin/cc-git-hook"
    "$HOME/bin/cc-git-hook"
    "/usr/local/bin/cc-git-hook"
)

for OLD_LINK in "${OLD_LINKS[@]}"; do
    if [ -L "$OLD_LINK" ]; then
        echo "   删除旧的符号链接: $OLD_LINK"
        rm -f "$OLD_LINK"
    fi
done

# 检查并删除旧的安装目录（基于 git clone 的方式）
OLD_INSTALL_DIR="$HOME/.claude-code-git-hook"
if [ -d "$OLD_INSTALL_DIR/.git" ]; then
    echo "   检测到旧的 git clone 安装方式"
    read -p "   是否删除旧的安装目录 $OLD_INSTALL_DIR? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$OLD_INSTALL_DIR"
        echo "   ✅ 已删除旧的安装目录"
    else
        echo "   ⚠️  保留旧目录，但可能会有冲突"
    fi
fi

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

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm，请先安装 npm"
    exit 1
fi

# 检查 git 是否可用
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 需要 Git 才能使用此工具"
    echo "   请先安装 Git"
    exit 1
fi

# ============================================================================
# 安装方式选择
# ============================================================================

INSTALL_FROM_GITHUB=${INSTALL_FROM_GITHUB:-true}

if [ "$INSTALL_FROM_GITHUB" = "true" ]; then
    # 从 GitHub 安装
    echo "📦 从 GitHub 安装最新版本..."
    echo ""
    
    # 创建临时目录
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # 克隆仓库
    echo "📥 正在下载..."
    if ! git clone --depth 1 https://github.com/SundayDX/claude-code-git-hook.git . 2>/dev/null; then
        echo "❌ 错误: 无法克隆仓库"
        echo "   请检查网络连接或稍后重试"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    # 打包并全局安装
    echo "📦 打包项目..."
    npm pack --silent > /dev/null
    
    PACKAGE_FILE=$(ls claude-code-git-hook-*.tgz)
    
    echo "🔧 全局安装..."
    npm install -g "$PACKAGE_FILE" --silent
    
    # 清理临时目录
    cd - > /dev/null
    rm -rf "$TEMP_DIR"
else
    # 从 npm registry 安装（如果已发布）
    echo "📦 从 npm 安装..."
    npm install -g claude-code-git-hook
fi

echo "✅ 安装完成！"
echo ""

# ============================================================================
# 配置全局 Hook
# ============================================================================

echo "⚙️  配置全局 Claude Code Hook..."

CLAUDE_DIR="$HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"

# 创建 .claude 目录
mkdir -p "$CLAUDE_DIR"

# 使用 Node.js 解析和合并 JSON 配置
export CLAUDE_SETTINGS_PATH="$CLAUDE_SETTINGS"
node << 'EOF'
const fs = require('fs');
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
  // 合并配置
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
echo "  cc-git-hook auto-commit            # 手动运行 auto-commit"
echo "  cc-git-hook doctor                 # 诊断工具"
echo "  cc-git-hook version                # 显示版本号"
echo "  cc-git-hook upgrade                # 检查并升级"
echo "  cc-git-hook help                   # 显示帮助信息"
echo ""
echo "📝 下一步："
echo "1. 运行 cc-git-hook doctor 检查安装状态"
echo "2. 在项目中使用 /squash-wip 命令"
echo ""

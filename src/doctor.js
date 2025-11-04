#!/usr/bin/env node

/**
 * Claude Code Git Hook Tool - Doctor 命令
 * 用于诊断和检查工具安装状态及配置
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logSection(title) {
  console.log('');
  log(`📋 ${title}`, 'blue');
  console.log('─'.repeat(50));
}

// 检查结果统计
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

/**
 * 检查命令是否在 PATH 中
 */
function checkCommand(command, description) {
  try {
    const output = execSync(`which ${command}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
    logSuccess(`${description}: ${output}`);
    results.passed++;
    return { success: true, path: output };
  } catch (error) {
    logError(`${description}: 未找到`);
    results.failed++;
    return { success: false, path: null };
  }
}

/**
 * 检查 Node.js 版本
 */
function checkNodeVersion() {
  try {
    const version = execSync('node -v', { encoding: 'utf8', stdio: 'pipe' }).trim();
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
    
    if (majorVersion >= 14) {
      logSuccess(`Node.js 版本: ${version} (>= 14.0.0)`);
      results.passed++;
      return { success: true, version };
    } else {
      logError(`Node.js 版本: ${version} (需要 >= 14.0.0)`);
      results.failed++;
      return { success: false, version };
    }
  } catch (error) {
    logError('Node.js: 未安装');
    results.failed++;
    return { success: false, version: null };
  }
}

/**
 * 检查 Git
 */
function checkGit() {
  try {
    const version = execSync('git --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    logSuccess(`Git: ${version}`);
    results.passed++;
    return { success: true, version };
  } catch (error) {
    logError('Git: 未安装');
    results.failed++;
    return { success: false, version: null };
  }
}

/**
 * 检查符号链接
 */
function checkSymlink(commandPath, expectedTarget) {
  if (!commandPath) {
    return { success: false, valid: false };
  }

  try {
    const realPath = fs.realpathSync(commandPath);
    const targetPath = path.resolve(expectedTarget);
    
    if (realPath === targetPath || fs.existsSync(realPath)) {
      logSuccess(`符号链接有效: ${commandPath} -> ${realPath}`);
      results.passed++;
      return { success: true, valid: true };
    } else {
      logWarning(`符号链接可能无效: ${commandPath}`);
      results.warnings++;
      return { success: false, valid: false };
    }
  } catch (error) {
    logWarning(`无法验证符号链接: ${commandPath}`);
    results.warnings++;
    return { success: false, valid: false };
  }
}

/**
 * 读取 JSON 文件（如果存在）
 */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logWarning(`配置文件格式错误: ${filePath} - ${error.message}`);
    results.warnings++;
    return null;
  }
}

/**
 * 检查全局 Hook 配置
 */
function checkGlobalHookConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'settings.json');
  
  if (!fs.existsSync(configPath)) {
    logError(`全局 Hook 配置不存在: ${configPath}`);
    results.failed++;
    return {
      success: false,
      exists: false,
      path: configPath,
      suggestion: `创建 ${configPath} 并添加 hook 配置`,
    };
  }

  const config = readJsonFile(configPath);
  if (!config) {
    return {
      success: false,
      exists: true,
      path: configPath,
      suggestion: '修复配置文件格式',
    };
  }

  // 检查是否有 Stop hook 配置
  const hasStopHook = config.hooks && 
                      config.hooks.Stop && 
                      Array.isArray(config.hooks.Stop) &&
                      config.hooks.Stop.length > 0;

  if (hasStopHook) {
    // 检查是否使用了正确的命令
    const stopHooks = config.hooks.Stop[0]?.hooks || [];
    const usesAutoCommit = stopHooks.some(hook => 
      hook.command && (
        hook.command.includes('cc-git-hook auto-commit') ||
        hook.command.includes('claude-code auto-commit') ||
        hook.command.includes('claude-code-auto-commit') ||
        hook.command.includes('auto-commit.js')
      )
    );

    if (usesAutoCommit) {
      logSuccess(`全局 Hook 配置存在且正确: ${configPath}`);
      results.passed++;
      return {
        success: true,
        exists: true,
        path: configPath,
        config: config,
      };
    } else {
      logWarning(`全局 Hook 配置存在但可能未配置 auto-commit: ${configPath}`);
      results.warnings++;
      return {
        success: false,
        exists: true,
        path: configPath,
        suggestion: '确保 hook 配置中包含 "cc-git-hook auto-commit" 命令',
      };
    }
  } else {
    logWarning(`全局 Hook 配置存在但未配置 Stop hook: ${configPath}`);
    results.warnings++;
    return {
      success: false,
      exists: true,
      path: configPath,
      suggestion: '添加 Stop hook 配置',
    };
  }
}

/**
 * 检查工具配置文件
 */
function checkToolConfig() {
  const configPath = path.join(os.homedir(), '.claude-git-hook.json');
  
  if (!fs.existsSync(configPath)) {
    logInfo(`工具配置文件不存在: ${configPath} (可选)`);
    return {
      success: true,
      exists: false,
      path: configPath,
    };
  }

  const config = readJsonFile(configPath);
  if (config) {
    logSuccess(`工具配置文件存在: ${configPath}`);
    results.passed++;
    return {
      success: true,
      exists: true,
      path: configPath,
      config: config,
    };
  }

  return {
    success: false,
    exists: true,
    path: configPath,
    suggestion: '修复配置文件格式',
  };
}

/**
 * 生成修复建议
 */
function generateSuggestions(checks) {
  const suggestions = [];

  // 检查命令安装
  if (!checks.commands.ccGitHook.success) {
    suggestions.push({
      title: '安装命令',
      command: 'bash scripts/install.sh',
      description: '运行安装脚本以创建全局命令符号链接',
    });
  }

  // 检查全局 Hook 配置
  if (!checks.globalHook.success) {
    const hookConfig = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: 'command',
                command: 'cc-git-hook auto-commit',
                timeout: 30,
              },
            ],
          },
        ],
      },
    };

    suggestions.push({
      title: '配置全局 Hook',
      command: `echo '${JSON.stringify(hookConfig, null, 2)}' > ~/.claude/settings.json`,
      description: `创建 ${checks.globalHook.path} 并添加 hook 配置`,
      config: hookConfig,
    });
  }

  return suggestions;
}

/**
 * 主函数
 */
function main() {
  console.log('');
  log('🔍 Claude Code Git Hook Tool - 诊断工具', 'cyan');
  console.log('='.repeat(60));
  console.log('');

  // 获取项目目录
  const projectDir = path.resolve(__dirname, '..');
  const ccGitHookPath = path.join(projectDir, 'src', 'cc-git-hook.js');

  const checks = {
    node: checkNodeVersion(),
    git: checkGit(),
    commands: {
      ccGitHook: checkCommand('cc-git-hook', 'cc-git-hook'),
    },
    globalHook: checkGlobalHookConfig(),
    toolConfig: checkToolConfig(),
  };

  // 检查符号链接
  if (checks.commands.ccGitHook.success) {
    checkSymlink(checks.commands.ccGitHook.path, ccGitHookPath);
  }

  // 显示摘要
  console.log('');
  logSection('检查摘要');
  logSuccess(`通过: ${results.passed}`);
  logError(`失败: ${results.failed}`);
  logWarning(`警告: ${results.warnings}`);

  // 生成修复建议
  const suggestions = generateSuggestions(checks);
  if (suggestions.length > 0) {
    console.log('');
    logSection('修复建议');
    
    suggestions.forEach((suggestion, index) => {
      console.log('');
      log(`${index + 1}. ${suggestion.title}`, 'yellow');
      logInfo(`${suggestion.description}`);
      
      if (suggestion.command) {
        console.log(`   命令: ${suggestion.command}`);
      }
      
      if (suggestion.config) {
        console.log(`   配置内容:`);
        console.log(JSON.stringify(suggestion.config, null, 2).split('\n').map(line => `   ${line}`).join('\n'));
      }
    });
  } else {
    console.log('');
    logSuccess('所有检查通过！配置正确。');
  }

  console.log('');
  process.exit(results.failed > 0 ? 1 : 0);
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { main };


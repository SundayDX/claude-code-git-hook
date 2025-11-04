#!/usr/bin/env node

/**
 * Claude Code Git Hook Tool - Doctor 命令
 * 用于诊断和检查工具安装状态及配置
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as version from './version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * 检查多个安装位置（检测冲突）
 */
function checkMultipleInstallations() {
  const possibleLocations = [
    '/usr/local/bin/cc-git-hook',
    `${os.homedir()}/.local/bin/cc-git-hook`,
    `${os.homedir()}/bin/cc-git-hook`,
  ];
  
  const found = [];
  
  for (const location of possibleLocations) {
    if (fs.existsSync(location)) {
      try {
        const realPath = fs.realpathSync(location);
        found.push({ link: location, target: realPath });
      } catch (error) {
        // 忽略错误
      }
    }
  }
  
  if (found.length === 0) {
    logWarning('未找到任何 cc-git-hook 安装');
    results.warnings++;
    return { success: false, locations: [] };
  } else if (found.length === 1) {
    logSuccess(`安装位置: ${found[0].link} -> ${found[0].target}`);
    results.passed++;
    return { success: true, locations: found };
  } else {
    logWarning(`检测到多个安装位置（可能冲突）:`);
    found.forEach(loc => {
      console.log(`   - ${loc.link} -> ${loc.target}`);
    });
    results.warnings++;
    return { success: false, locations: found, hasConflict: true };
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
 * 检查 Slash 命令配置
 */
function checkSlashCommands() {
  logSection('检查 Slash 命令配置');
  
  const commandsDir = path.join(os.homedir(), '.claude', 'commands');
  const squashWipCommand = path.join(commandsDir, 'squash-wip.md');
  
  let hasIssues = false;
  
  // 检查 commands 目录
  if (!fs.existsSync(commandsDir)) {
    logError(`目录不存在: ~/.claude/commands/`);
    logInfo('  建议: 创建该目录');
    logInfo(`  命令: mkdir -p "${commandsDir}"`);
    results.failed++;
    hasIssues = true;
  } else {
    logSuccess('Commands 目录存在');
    results.passed++;
  }
  
  // 检查 squash-wip 命令文件
  if (!fs.existsSync(squashWipCommand)) {
    logError('squash-wip 命令未配置');
    logInfo('  /squash-wip 命令将无法在 Claude Code 中使用');
    logInfo('  建议: 重新运行安装脚本或手动创建命令文件');
    
    // 检查包中是否有模板文件
    const templatePath = path.join(getInstallDir(), '.claude', 'commands', 'squash-wip.md');
    if (fs.existsSync(templatePath)) {
      logInfo(`  命令: cp "${templatePath}" "${squashWipCommand}"`);
    } else {
      logInfo('  或运行: npm install -g claude-code-git-hook');
    }
    
    results.failed++;
    hasIssues = true;
  } else {
    logSuccess('/squash-wip 命令已配置');
    results.passed++;
    
    // 验证命令文件内容
    try {
      const content = fs.readFileSync(squashWipCommand, 'utf8');
      if (!content.includes('cc-git-hook squash-wip')) {
        logWarning('命令文件内容可能不正确');
        logInfo('  建议: 检查命令执行部分是否为 "cc-git-hook squash-wip"');
        results.warnings++;
        hasIssues = true;
      }
    } catch (error) {
      logWarning('无法读取命令文件');
      results.warnings++;
    }
  }
  
  return {
    success: !hasIssues,
    commandsDir,
    squashWipCommand,
  };
}

/**
 * 获取安装目录
 */
function getInstallDir() {
  // 尝试从全局 node_modules 找到包路径
  try {
    const { execSync } = require('child_process');
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return path.join(npmRoot, 'claude-code-git-hook');
  } catch (error) {
    // 如果失败，返回备用路径
    return path.join(os.homedir(), '.claude-code-git-hook');
  }
}

/**
 * 主函数
 */
function main() {
  console.log('');
  log('🔍 Claude Code Git Hook Tool - 诊断工具', 'cyan');
  console.log('='.repeat(60));
  
  // 显示版本信息
  const versionInfo = version.getFullVersionInfo();
  log(`版本: ${versionInfo.display}`, 'cyan');
  if (versionInfo.date) {
    log(`日期: ${versionInfo.date}`, 'cyan');
  }
  if (versionInfo.source) {
    log(`来源: ${versionInfo.source}`, 'cyan');
  }
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
    installations: checkMultipleInstallations(),
    globalHook: checkGlobalHookConfig(),
    slashCommands: checkSlashCommands(),
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

  // 添加多安装位置的警告
  if (checks.installations.hasConflict) {
    console.log('');
    logSection('⚠️  检测到冲突');
    logWarning('发现多个 cc-git-hook 安装位置！');
    logInfo('这可能导致执行错误的版本，取决于 PATH 中的目录顺序。');
    logInfo('');
    logInfo('建议：');
    logInfo('1. 卸载所有旧版本: npm uninstall -g claude-code-git-hook');
    logInfo('2. 删除手动创建的符号链接');
    logInfo('3. 重新安装: curl -fsSL https://raw.githubusercontent.com/SundayDX/claude-code-git-hook/main/scripts/install.sh | bash');
  }
  
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
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };


#!/usr/bin/env node

/**
 * 配置命令模块
 * 支持查看、设置和管理配置项
 */

const config = require('./config');
const path = require('path');

/**
 * 验证日志级别
 * @param {string} level - 日志级别
 * @returns {boolean} 是否有效
 */
function isValidLogLevel(level) {
  return ['error', 'warn', 'info', 'debug'].includes(level);
}

/**
 * 格式化配置值用于显示
 * @param {*} value - 配置值
 * @returns {string} 格式化后的字符串
 */
function formatValue(value) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * 列出所有配置
 */
function listConfig() {
  const appConfig = config.loadConfig();
  const configPath = config.getConfigPath();
  
  console.log('当前配置:');
  console.log('');
  
  // 显示配置文件路径
  if (configPath) {
    console.log(`配置文件: ${configPath}`);
  } else {
    console.log('配置文件: 不存在（将使用默认配置）');
  }
  console.log('');
  
  // 显示所有配置项
  console.log(JSON.stringify(appConfig, null, 2));
}

/**
 * 获取配置值
 * @param {string} key - 配置键
 */
function getConfigValue(key) {
  if (!key) {
    console.error('错误: 请指定配置键');
    console.error('用法: cc-git-hook config get <key>');
    console.error('示例: cc-git-hook config get logging.level');
    process.exit(1);
  }
  
  const value = config.getConfig(key);
  const configPath = config.getConfigPath();
  
  if (value === null) {
    console.error(`错误: 配置键 "${key}" 不存在`);
    process.exit(1);
  }
  
  console.log(formatValue(value));
  
  if (process.env.DEBUG) {
    console.log(`\n配置来源: ${configPath || '默认配置'}`);
  }
}

/**
 * 设置配置值
 * @param {string} key - 配置键
 * @param {string} value - 配置值
 */
function setConfigValue(key, value) {
  if (!key) {
    console.error('错误: 请指定配置键');
    console.error('用法: cc-git-hook config set <key> <value>');
    console.error('示例: cc-git-hook config set logging.level debug');
    process.exit(1);
  }
  
  if (value === undefined || value === null) {
    console.error('错误: 请指定配置值');
    console.error('用法: cc-git-hook config set <key> <value>');
    console.error('示例: cc-git-hook config set logging.enabled false');
    process.exit(1);
  }
  
  // 特殊验证：如果是日志级别，验证其有效性
  if (key === 'logging.level') {
    if (!isValidLogLevel(value)) {
      console.error(`错误: 无效的日志级别 "${value}"`);
      console.error('有效的日志级别: error, warn, info, debug');
      process.exit(1);
    }
  }
  
  // 特殊验证：如果是布尔值配置，验证格式
  const booleanKeys = [
    'logging.enabled',
    'logging.verbose',
    'autoCommit.enabled',
    'autoCommit.includeFileSummary',
    'squashWip.autoGenerateMessage',
    'squashWip.showPreview',
    'git.autoStage',
    'git.safeMode',
    'debug.enabled',
    'debug.verbose',
  ];
  
  if (booleanKeys.includes(key)) {
    const lowerValue = String(value).toLowerCase();
    if (!['true', 'false', '1', '0'].includes(lowerValue)) {
      console.error(`错误: 配置项 "${key}" 需要布尔值 (true/false)`);
      process.exit(1);
    }
  }
  
  // 设置配置
  const success = config.setConfig(key, value);
  
  if (!success) {
    console.error('错误: 设置配置失败');
    process.exit(1);
  }
  
  const configPath = config.getConfigPath();
  console.log(`✓ 配置已更新: ${key} = ${formatValue(value)}`);
  console.log(`配置文件: ${configPath}`);
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
配置管理命令

用法:
  cc-git-hook config <subcommand> [options]

子命令:
  list                 列出所有配置项
  get <key>            获取指定配置项的值
  set <key> <value>    设置配置项的值

示例:
  cc-git-hook config list                           # 列出所有配置
  cc-git-hook config get logging.level              # 查看日志级别
  cc-git-hook config set logging.level debug        # 设置日志级别为 debug
  cc-git-hook config set logging.enabled false      # 禁用日志输出
  cc-git-hook config set logging.verbose true       # 启用详细模式

日志配置项:
  logging.enabled     是否启用日志 (true/false)
  logging.level       日志级别 (error/warn/info/debug)
  logging.verbose     详细模式 (true/false)
`);
}

/**
 * 主函数
 * @param {...any} args - 命令行参数
 */
function main(...args) {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }
  
  const subcommand = args[0];
  
  switch (subcommand) {
    case 'list':
      listConfig();
      break;
      
    case 'get':
      getConfigValue(args[1]);
      break;
      
    case 'set':
      setConfigValue(args[1], args[2]);
      break;
      
    default:
      console.error(`错误: 未知子命令 "${subcommand}"`);
      console.error('');
      showHelp();
      process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main(...process.argv.slice(2));
}

module.exports = {
  main,
};


#!/usr/bin/env node

/**
 * 日志工具模块
 * 支持配置化的日志输出，根据配置决定是否输出日志
 * 支持同时输出到控制台和文件
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 日志级别定义（数字越小优先级越高）
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * 获取安装根目录
 * @returns {string} 安装根目录路径
 */
function getInstallRoot() {
  // 优先使用环境变量
  if (process.env.CC_GIT_HOOK_INSTALL_ROOT) {
    if (process.env.DEBUG) {
      console.error(`[DEBUG] getInstallRoot: 使用环境变量 ${process.env.CC_GIT_HOOK_INSTALL_ROOT}`);
    }
    return process.env.CC_GIT_HOOK_INSTALL_ROOT;
  }
  
  // 通过 __dirname 判断
  // 如果当前文件在 src 目录下，向上两级就是安装根目录
  const currentDir = __dirname;
  const basename = path.basename(currentDir);
  
  if (process.env.DEBUG) {
    console.error(`[DEBUG] getInstallRoot: __dirname=${currentDir}, basename=${basename}`);
  }
  
  // 如果当前目录名是 'src'，说明在安装目录的 src 子目录下
  if (basename === 'src') {
    const root = path.dirname(currentDir);
    if (process.env.DEBUG) {
      console.error(`[DEBUG] getInstallRoot: 当前目录是 src，使用父目录 ${root}`);
    }
    return root;
  }
  
  // 如果当前目录的父目录有 src 子目录，说明在项目根目录
  const parentDir = path.dirname(currentDir);
  if (fs.existsSync(path.join(parentDir, 'src'))) {
    if (process.env.DEBUG) {
      console.error(`[DEBUG] getInstallRoot: 父目录有 src 子目录，使用 ${parentDir}`);
    }
    return parentDir;
  }
  
  // 默认使用用户主目录下的安装目录
  const defaultRoot = path.join(os.homedir(), '.claude-code-git-hook');
  if (process.env.DEBUG) {
    console.error(`[DEBUG] getInstallRoot: 使用默认路径 ${defaultRoot}`);
  }
  return defaultRoot;
}

/**
 * 确保日志目录存在
 * @param {string} logDir - 日志目录路径
 * @returns {boolean} 是否成功
 */
function ensureLogDir(logDir) {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return true;
  } catch (error) {
    // 静默失败，不影响主程序运行
    return false;
  }
}

/**
 * 获取日志文件路径
 * @param {string|null} configFilePath - 配置的日志文件路径
 * @returns {string|null} 日志文件路径，如果不需要文件日志则返回 null
 */
function getLogFilePath(configFilePath) {
  // 如果配置中指定了文件路径，使用配置的路径
  if (configFilePath) {
    return configFilePath;
  }
  
  // 使用默认路径：安装目录/logs/YYYY-MM-DD.log
  const installRoot = getInstallRoot();
  const logsDir = path.join(installRoot, 'logs');
  
  // 确保 logs 目录存在
  if (!ensureLogDir(logsDir)) {
    return null;
  }
  
  // 生成按日期的日志文件名
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFileName = `${dateStr}.log`;
  
  return path.join(logsDir, logFileName);
}

/**
 * 写入日志到文件
 * @param {string} logFilePath - 日志文件路径
 * @param {string} level - 日志级别
 * @param {...any} args - 日志参数
 */
function writeToFile(logFilePath, level, ...args) {
  if (!logFilePath) {
    if (process.env.DEBUG) {
      console.error(`[DEBUG] writeToFile: logFilePath 为 null，跳过写入`);
    }
    return;
  }
  
  if (process.env.DEBUG) {
    console.error(`[DEBUG] writeToFile: 准备写入到 ${logFilePath}`);
  }
  
  try {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // 追加写入文件
    fs.appendFileSync(logFilePath, logLine, 'utf8');
    
    if (process.env.DEBUG) {
      console.error(`[DEBUG] writeToFile: 写入成功`);
    }
  } catch (error) {
    // 静默失败，不影响主程序运行
    // 仅在调试模式下输出错误
    if (process.env.DEBUG) {
      console.error(`写入日志文件失败: ${error.message}`);
      console.error(`错误详情:`, error.stack);
    }
  }
}

/**
 * 创建日志工具实例
 * @param {Object} loggerConfig - 日志配置（可选，默认从配置文件读取）
 * @returns {Object} 日志工具对象
 */
function createLogger(loggerConfig = null) {
  const appConfig = config.loadConfig();
  const logConfig = loggerConfig || appConfig.logging || { enabled: true, level: 'error', verbose: false, filePath: null };
  
  const enabled = logConfig.enabled !== false; // 默认启用
  const level = logConfig.level || 'error';
  const verboseMode = logConfig.verbose || false;
  const minLevel = LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.error;
  
  // 获取日志文件路径
  const logFilePath = getLogFilePath(logConfig.filePath);
  
  if (process.env.DEBUG) {
    console.error(`[DEBUG] createLogger: enabled=${enabled}, level=${level}, minLevel=${minLevel}, logFilePath=${logFilePath}`);
  }
  
  /**
   * 检查是否应该输出日志
   * @param {string} logLevel - 日志级别
   * @returns {boolean} 是否应该输出
   */
  function shouldLog(logLevel) {
    if (!enabled) {
      return false;
    }
    const currentLevel = LOG_LEVELS[logLevel] !== undefined ? LOG_LEVELS[logLevel] : LOG_LEVELS.error;
    return currentLevel <= minLevel;
  }
  
  /**
   * 输出错误日志
   * @param {...any} args - 日志参数
   */
  function error(...args) {
    if (shouldLog('error')) {
      console.error(...args);
      writeToFile(logFilePath, 'error', ...args);
    }
  }
  
  /**
   * 输出警告日志
   * @param {...any} args - 日志参数
   */
  function warn(...args) {
    if (shouldLog('warn')) {
      console.warn(...args);
      writeToFile(logFilePath, 'warn', ...args);
    }
  }
  
  /**
   * 输出信息日志
   * @param {...any} args - 日志参数
   */
  function info(...args) {
    if (shouldLog('info')) {
      console.log(...args);
      writeToFile(logFilePath, 'info', ...args);
    }
  }
  
  /**
   * 输出调试日志
   * @param {...any} args - 日志参数
   */
  function debug(...args) {
    if (shouldLog('debug') || verboseMode) {
      console.log(...args);
      writeToFile(logFilePath, 'debug', ...args);
    }
  }
  
  /**
   * 输出详细调试日志（仅在 verbose 模式下输出）
   * @param {...any} args - 日志参数
   */
  function verbose(...args) {
    if (verboseMode) {
      console.log(...args);
      writeToFile(logFilePath, 'verbose', ...args);
    }
  }
  
  return {
    error,
    warn,
    info,
    debug,
    verbose,
    // 导出配置状态，方便外部检查
    isEnabled: enabled,
    level: level,
  };
}

// 导出默认日志实例（使用配置文件）
const defaultLogger = createLogger();

export {
  createLogger,
  defaultLogger,
  LOG_LEVELS,
};


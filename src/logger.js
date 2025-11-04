#!/usr/bin/env node

/**
 * 日志工具模块
 * 支持配置化的日志输出，根据配置决定是否输出日志
 */

const config = require('./config');

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
 * 创建日志工具实例
 * @param {Object} loggerConfig - 日志配置（可选，默认从配置文件读取）
 * @returns {Object} 日志工具对象
 */
function createLogger(loggerConfig = null) {
  const appConfig = config.loadConfig();
  const logConfig = loggerConfig || appConfig.logging || { enabled: true, level: 'info', verbose: false };
  
  const enabled = logConfig.enabled !== false; // 默认启用
  const level = logConfig.level || 'info';
  const verboseMode = logConfig.verbose || false;
  const minLevel = LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.info;
  
  /**
   * 检查是否应该输出日志
   * @param {string} logLevel - 日志级别
   * @returns {boolean} 是否应该输出
   */
  function shouldLog(logLevel) {
    if (!enabled) {
      return false;
    }
    const currentLevel = LOG_LEVELS[logLevel] !== undefined ? LOG_LEVELS[logLevel] : LOG_LEVELS.info;
    return currentLevel <= minLevel;
  }
  
  /**
   * 输出错误日志
   * @param {...any} args - 日志参数
   */
  function error(...args) {
    if (shouldLog('error')) {
      console.error(...args);
    }
  }
  
  /**
   * 输出警告日志
   * @param {...any} args - 日志参数
   */
  function warn(...args) {
    if (shouldLog('warn')) {
      console.warn(...args);
    }
  }
  
  /**
   * 输出信息日志
   * @param {...any} args - 日志参数
   */
  function info(...args) {
    if (shouldLog('info')) {
      console.log(...args);
    }
  }
  
  /**
   * 输出调试日志
   * @param {...any} args - 日志参数
   */
  function debug(...args) {
    if (shouldLog('debug') || verboseMode) {
      console.log(...args);
    }
  }
  
  /**
   * 输出详细调试日志（仅在 verbose 模式下输出）
   * @param {...any} args - 日志参数
   */
  function verbose(...args) {
    if (verboseMode) {
      console.log(...args);
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

module.exports = {
  createLogger,
  defaultLogger,
  LOG_LEVELS,
};


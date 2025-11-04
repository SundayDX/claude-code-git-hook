#!/usr/bin/env node

/**
 * 配置文件管理
 * 支持从配置文件和环境变量读取配置
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 默认配置
 */
const defaultConfig = {
  autoCommit: {
    enabled: true,
    prefix: '[AUTO-WIP]',
    includeFileSummary: true,
    maxMessageLength: 100,
  },
  squashWip: {
    autoGenerateMessage: true,
    showPreview: true,
  },
  git: {
    autoStage: true,
    safeMode: true, // 安全模式：错误不会中断流程
  },
  debug: {
    enabled: false,
    verbose: false,
  },
  logging: {
    enabled: true, // 是否启用日志输出
    level: 'error', // 日志级别: 'error', 'warn', 'info', 'debug'（默认：error）
    verbose: false, // 详细模式：输出更多调试信息
    filePath: null, // 日志文件路径（null 表示使用默认路径：安装目录/logs/YYYY-MM-DD.log）
  },
};

/**
 * 配置文件路径
 */
const configPaths = [
  path.join(process.cwd(), '.claude-git-hook.json'), // 项目级配置
  path.join(os.homedir(), '.claude-git-hook.json'),  // 用户级配置
];

/**
 * 读取配置文件
 * @returns {Object} 配置对象
 */
function loadConfig() {
  let config = { ...defaultConfig };

  // 从配置文件读取
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        config = { ...config, ...fileConfig };
        if (process.env.DEBUG) {
          console.log(`加载配置文件: ${configPath}`);
        }
      } catch (error) {
        if (process.env.DEBUG) {
          console.error(`读取配置文件失败 ${configPath}:`, error.message);
        }
      }
    }
  }

  // 从环境变量读取（优先级最高）
  if (process.env.CLAUDE_GIT_HOOK_DEBUG) {
    config.debug.enabled = true;
  }

  if (process.env.CLAUDE_GIT_HOOK_AUTO_COMMIT === 'false') {
    config.autoCommit.enabled = false;
  }

  if (process.env.CLAUDE_GIT_HOOK_PREFIX) {
    config.autoCommit.prefix = process.env.CLAUDE_GIT_HOOK_PREFIX;
  }

  return config;
}

/**
 * 保存配置文件
 * @param {Object} config - 配置对象
 * @param {string} configPath - 配置文件路径（可选）
 */
function saveConfig(config, configPath = null) {
  const targetPath = configPath || configPaths[0];
  
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      targetPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );
    
    return true;
  } catch (error) {
    console.error(`保存配置文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取配置值
 * @param {string} key - 配置键（支持点号分隔，如 'autoCommit.enabled'）
 * @param {*} defaultValue - 默认值
 * @returns {*} 配置值
 */
function getConfig(key, defaultValue = null) {
  const config = loadConfig();
  const keys = key.split('.');
  let value = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }

  return value !== undefined ? value : defaultValue;
}

/**
 * 获取当前使用的配置文件路径
 * @returns {string|null} 配置文件路径，如果不存在则返回null
 */
function getConfigPath() {
  // 优先返回项目级配置，如果不存在则返回用户级配置
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  // 如果都不存在，返回项目级配置路径（用于创建新配置）
  return configPaths[0];
}

/**
 * 设置配置值
 * @param {string} key - 配置键（支持点号分隔，如 'logging.level'）
 * @param {*} value - 配置值
 * @param {boolean} useUserConfig - 是否使用用户级配置（默认使用项目级配置）
 * @returns {boolean} 是否成功
 */
function setConfig(key, value, useUserConfig = false) {
  const targetPath = useUserConfig ? configPaths[1] : configPaths[0];
  
  try {
    // 加载现有配置或使用默认配置
    let config = { ...defaultConfig };
    
    // 如果配置文件存在，先读取现有配置
    if (fs.existsSync(targetPath)) {
      try {
        const fileContent = fs.readFileSync(targetPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        config = { ...config, ...fileConfig };
      } catch (error) {
        // 如果读取失败，使用默认配置
        if (process.env.DEBUG) {
          console.error(`读取配置文件失败 ${targetPath}:`, error.message);
        }
      }
    }
    
    // 解析键路径并设置值
    const keys = key.split('.');
    let current = config;
    
    // 遍历到倒数第二层，创建必要的嵌套对象
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    // 设置最后一层的值
    const lastKey = keys[keys.length - 1];
    
    // 类型转换：如果是布尔值字符串，转换为布尔值
    let finalValue = value;
    if (typeof value === 'string') {
      if (value === 'true' || value === '1') {
        finalValue = true;
      } else if (value === 'false' || value === '0') {
        finalValue = false;
      }
    }
    
    current[lastKey] = finalValue;
    
    // 保存配置
    return saveConfig(config, targetPath);
  } catch (error) {
    console.error(`设置配置失败: ${error.message}`);
    return false;
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  setConfig,
  getConfigPath,
  defaultConfig,
  configPaths,
};


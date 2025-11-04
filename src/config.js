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

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  defaultConfig,
  configPaths,
};


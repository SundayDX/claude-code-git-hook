#!/usr/bin/env node

/**
 * 版本信息模块
 * 显示当前工具版本
 */

const fs = require('fs');
const path = require('path');

/**
 * 获取当前版本号
 * @returns {string} 版本号
 */
function getVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * 显示版本信息
 */
function main() {
  const version = getVersion();
  console.log(`cc-git-hook version ${version}`);
  console.log(`Repository: https://github.com/SundayDX/claude-code-git-hook`);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  main,
  getVersion,
};


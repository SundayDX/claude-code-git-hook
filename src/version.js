#!/usr/bin/env node

/**
 * 版本信息模块
 * 显示当前工具版本，支持 Git hash 和语义化版本号
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 获取当前版本号（从 package.json）
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
 * 获取 Git commit hash
 * @param {boolean} full - 是否返回完整 hash（默认返回短 hash）
 * @returns {string|null} commit hash 或 null
 */
function getGitHash(full = false) {
  try {
    const command = full ? 'git rev-parse HEAD' : 'git rev-parse --short HEAD';
    const hash = execSync(command, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return hash;
  } catch (error) {
    return null;
  }
}

/**
 * 获取当前 commit 的时间戳
 * @returns {string|null} ISO 格式的时间戳或 null
 */
function getCommitTimestamp() {
  try {
    const timestamp = execSync('git log -1 --format=%cI', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return timestamp;
  } catch (error) {
    return null;
  }
}

/**
 * 获取距离最近 tag 的 commit 数量
 * @returns {number} commit 数量，如果没有 tag 返回 0
 */
function getCommitsSinceTag() {
  try {
    // 尝试获取最近的 tag
    const latestTag = execSync('git describe --tags --abbrev=0', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    // 获取从 tag 到 HEAD 的 commit 数量
    const commits = execSync(`git rev-list ${latestTag}..HEAD --count`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    return parseInt(commits, 10) || 0;
  } catch (error) {
    // 如果没有 tag，返回总 commit 数
    try {
      const totalCommits = execSync('git rev-list --count HEAD', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return parseInt(totalCommits, 10) || 0;
    } catch (e) {
      return 0;
    }
  }
}

/**
 * 从 VERSION.json 文件读取版本信息（用于生产环境）
 * @returns {Object|null} 版本信息对象或 null
 */
function readVersionFile() {
  try {
    const versionPath = path.join(__dirname, 'VERSION.json');
    if (fs.existsSync(versionPath)) {
      const content = fs.readFileSync(versionPath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 获取完整的版本信息
 * @returns {Object} 版本信息对象
 */
function getFullVersionInfo() {
  const version = getVersion();
  
  // 首先尝试从 Git 获取信息（开发环境）
  let hash = getGitHash(false);
  let fullHash = getGitHash(true);
  let timestamp = getCommitTimestamp();
  let commits = getCommitsSinceTag();
  let source = 'git';
  
  // 如果 Git 信息不可用，尝试从 VERSION.json 读取（生产环境）
  if (!hash) {
    const versionFile = readVersionFile();
    if (versionFile) {
      hash = versionFile.hash || null;
      fullHash = versionFile.fullHash || null;
      timestamp = versionFile.timestamp || null;
      commits = versionFile.commits || 0;
      source = 'file';
    }
  }
  
  // 格式化日期
  let date = null;
  if (timestamp) {
    try {
      date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    } catch (e) {
      date = null;
    }
  }
  
  // 生成显示格式：日期+commits数量+hash
  let display = hash || `v${version}`;
  if (hash && date) {
    const dateStr = date.replace(/-/g, '.'); // 2025.11.04
    if (commits > 0) {
      display = `${dateStr}+${commits}-${hash}`;
    } else {
      display = `${dateStr}-${hash}`;
    }
  } else if (hash) {
    // 如果有 hash 但没有日期，使用 hash
    display = hash;
  }
  
  return {
    version,
    hash,
    fullHash,
    commits,
    timestamp,
    date,
    display,
    source,
  };
}

/**
 * 显示版本信息
 */
function main() {
  const versionInfo = getFullVersionInfo();
  
  console.log(`cc-git-hook ${versionInfo.display}`);
  
  if (versionInfo.date) {
    console.log(`Date: ${versionInfo.date}`);
  }
  
  if (versionInfo.fullHash) {
    console.log(`Commit: ${versionInfo.fullHash}`);
  }
  
  if (versionInfo.source) {
    console.log(`Source: ${versionInfo.source}`);
  }
  
  console.log(`Repository: https://github.com/SundayDX/claude-code-git-hook`);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  main,
  getVersion,
  getGitHash,
  getCommitTimestamp,
  getCommitsSinceTag,
  getFullVersionInfo,
  readVersionFile,
};


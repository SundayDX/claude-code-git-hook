#!/usr/bin/env node

/**
 * 生成版本信息文件
 * 在 npm publish 前执行，将当前的 Git 信息写入 VERSION.json
 * 用于在生产环境（无 .git 目录）中获取版本信息
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 执行 git 命令
 * @param {string} command - git 命令
 * @returns {string|null} 命令输出或 null
 */
function execGitCommand(command) {
  try {
    return execSync(command, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * 获取 package.json 版本
 * @returns {string} 版本号
 */
function getPackageVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

/**
 * 生成版本信息
 * @returns {Object} 版本信息对象
 */
function generateVersionInfo() {
  const version = getPackageVersion();
  const fullHash = execGitCommand('git rev-parse HEAD');
  const hash = execGitCommand('git rev-parse --short HEAD');
  const timestamp = execGitCommand('git log -1 --format=%cI');
  
  // 获取距离最近 tag 的 commit 数量
  let commits = 0;
  const latestTag = execGitCommand('git describe --tags --abbrev=0');
  if (latestTag) {
    const commitsStr = execGitCommand(`git rev-list ${latestTag}..HEAD --count`);
    commits = parseInt(commitsStr, 10) || 0;
  } else {
    const totalCommitsStr = execGitCommand('git rev-list --count HEAD');
    commits = parseInt(totalCommitsStr, 10) || 0;
  }
  
  return {
    version,
    hash,
    fullHash,
    commits,
    timestamp,
    generated: new Date().toISOString(),
  };
}

/**
 * 主函数
 */
function main() {
  console.log('🔨 生成版本信息文件...\n');
  
  try {
    const versionInfo = generateVersionInfo();
    
    console.log(`版本: v${versionInfo.version}`);
    console.log(`Commit: ${versionInfo.hash} (${versionInfo.fullHash})`);
    console.log(`Commits: ${versionInfo.commits}`);
    console.log(`Date: ${versionInfo.timestamp}`);
    console.log('');
    
    // 写入 VERSION.json
    const versionFilePath = path.join(__dirname, '..', 'src', 'VERSION.json');
    fs.writeFileSync(
      versionFilePath,
      JSON.stringify(versionInfo, null, 2),
      'utf8'
    );
    
    console.log(`✅ 版本信息已写入: ${versionFilePath}`);
    console.log('');
  } catch (error) {
    console.error('❌ 生成版本信息失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main();


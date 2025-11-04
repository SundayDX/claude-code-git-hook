#!/usr/bin/env node

/**
 * 升级模块
 * 使用 npm update -g 升级全局安装的包
 */

import https from 'https';
import { execSync } from 'child_process';
import readline from 'readline';
import os from 'os';
import path from 'path';
import fs from 'fs';
import * as version from './version.js';

/**
 * 升级模式
 */
const UPGRADE_MODE = {
  STABLE: 'stable',   // 升级到最新 release
  LATEST: 'latest',   // 升级到最新 commit
};

/**
 * 仓库相关常量
 */
const REPO_DIR = path.join(os.homedir(), '.claude-code-git-hook');
const REPO_URL = 'https://github.com/SundayDX/claude-code-git-hook.git';

/**
 * 比较版本号
 * @param {string} v1 - 版本1
 * @param {string} v2 - 版本2
 * @returns {number} -1: v1 < v2, 0: v1 === v2, 1: v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
}

/**
 * 从 GitHub API 获取最新版本（release）
 * @returns {Promise<string|null>} 最新版本号
 */
function getLatestVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/SundayDX/claude-code-git-hook/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'cc-git-hook',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const release = JSON.parse(data);
            const latestVersion = release.tag_name.replace(/^v/, '');
            resolve(latestVersion);
          } catch (error) {
            reject(new Error('无法解析版本信息'));
          }
        } else if (res.statusCode === 404) {
          reject(new Error('仓库中还没有创建任何发布版本。'));
        } else {
          reject(new Error(`GitHub API 错误: ${res.statusCode}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 从 GitHub API 获取最新 commit 信息
 * @param {string} branch - 分支名称（默认 main）
 * @returns {Promise<Object>} commit 信息对象
 */
function getLatestCommit(branch = 'main') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/SundayDX/claude-code-git-hook/commits/${branch}`,
      method: 'GET',
      headers: {
        'User-Agent': 'cc-git-hook',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const commit = JSON.parse(data);
            resolve({
              sha: commit.sha,
              shortSha: commit.sha.substring(0, 7),
              message: commit.commit.message.split('\n')[0],
              date: commit.commit.author.date,
              author: commit.commit.author.name,
            });
          } catch (error) {
            reject(new Error('无法解析 commit 信息'));
          }
        } else {
          reject(new Error(`GitHub API 错误: ${res.statusCode}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 比较本地 hash 和远程 commit
 * @param {string} localHash - 本地 commit hash
 * @param {Object} remoteCommit - 远程 commit 信息
 * @returns {Object} 比较结果
 */
function compareWithCommit(localHash, remoteCommit) {
  if (!localHash) {
    return {
      needsUpdate: true,
      reason: '无法获取本地版本信息',
    };
  }

  if (!remoteCommit || !remoteCommit.sha) {
    return {
      needsUpdate: false,
      reason: '无法获取远程版本信息',
    };
  }

  // 比较完整 hash 或短 hash
  const localShort = localHash.substring(0, 7);
  const remoteShort = remoteCommit.shortSha || remoteCommit.sha.substring(0, 7);

  if (localHash === remoteCommit.sha || localShort === remoteShort) {
    return {
      needsUpdate: false,
      reason: '已是最新版本',
      upToDate: true,
    };
  }

  // 不同的 hash，需要更新
  return {
    needsUpdate: true,
    reason: '发现新的提交',
    localHash: localShort,
    remoteHash: remoteShort,
    remoteMessage: remoteCommit.message,
    remoteDate: remoteCommit.date,
  };
}

/**
 * 检查目录是否为 git 仓库
 * @param {string} dir - 目录路径
 * @returns {boolean} 是否为 git 仓库
 */
function isGitRepository(dir) {
  try {
    const gitDir = path.join(dir, '.git');
    return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * 确保仓库目录存在且为最新
 * @returns {Promise<void>}
 */
async function ensureRepository() {
  console.log(`📁 检查仓库目录: ${REPO_DIR}`);
  
  // 检查目录是否存在
  if (!fs.existsSync(REPO_DIR)) {
    // 目录不存在，执行克隆
    console.log('📥 目录不存在，正在克隆仓库...');
    execSync(`git clone ${REPO_URL} "${REPO_DIR}"`, {
      stdio: 'inherit'
    });
    console.log('✅ 仓库克隆完成');
    return;
  }
  
  // 目录存在，检查是否为 git 仓库
  if (!isGitRepository(REPO_DIR)) {
    // 不是 git 仓库，删除后重新克隆
    console.log('⚠️  目录存在但不是 git 仓库，将删除并重新克隆...');
    execSync(`rm -rf "${REPO_DIR}"`, { stdio: 'pipe' });
    execSync(`git clone ${REPO_URL} "${REPO_DIR}"`, {
      stdio: 'inherit'
    });
    console.log('✅ 仓库克隆完成');
    return;
  }
  
  // 是 git 仓库，重置并更新
  console.log('🔄 更新现有仓库...');
  execSync('git reset --hard HEAD', {
    cwd: REPO_DIR,
    stdio: 'pipe'
  });
  execSync('git pull', {
    cwd: REPO_DIR,
    stdio: 'inherit'
  });
  console.log('✅ 仓库更新完成');
}

/**
 * 执行升级
 */
async function performUpgrade() {
  console.log('\n开始升级...\n');
  
  try {
    // 确保仓库目录存在且为最新
    await ensureRepository();
    
    // 安装项目依赖
    console.log('\n📦 安装项目依赖...');
    execSync('npm install', {
      cwd: REPO_DIR,
      stdio: 'inherit'
    });
    
    // 在仓库目录执行全局安装
    console.log('\n🔧 正在安装 claude-code-git-hook...');
    execSync('npm install -g .', {
      cwd: REPO_DIR,
      stdio: 'inherit'
    });
    
    console.log('\n✅ 升级完成！');
    console.log(`\n当前版本: v${version.getVersion()}`);
  } catch (error) {
    console.error('\n❌ 升级失败:', error.message);
    console.log('\n请尝试手动升级：');
    console.log(`  1. cd ${REPO_DIR}`);
    console.log('  2. git pull');
    console.log('  3. npm install -g .');
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let mode = UPGRADE_MODE.STABLE; // 默认模式：稳定版
  
  if (args.includes('--latest') || args.includes('-l')) {
    mode = UPGRADE_MODE.LATEST;
  } else if (args.includes('--stable') || args.includes('-s')) {
    mode = UPGRADE_MODE.STABLE;
  }
  
  console.log('🔍 检查更新...\n');
  
  const versionInfo = version.getFullVersionInfo();
  console.log(`当前版本: ${versionInfo.display}`);
  if (versionInfo.date) {
    console.log(`构建日期: ${versionInfo.date}`);
  }
  console.log('');
  
  let needsUpdate = false;
  let updateInfo = {};
  
  if (mode === UPGRADE_MODE.LATEST) {
    // 检查最新 commit
    console.log('检查模式: 最新开发版 (--latest)');
    try {
      const latestCommit = await getLatestCommit();
      console.log(`最新提交: ${latestCommit.shortSha}`);
      console.log(`提交信息: ${latestCommit.message}`);
      console.log(`提交日期: ${new Date(latestCommit.date).toISOString().split('T')[0]}`);
      
      const comparison = compareWithCommit(versionInfo.fullHash || versionInfo.hash, latestCommit);
      
      if (comparison.upToDate) {
        console.log('\n✅ 已是最新版本！');
        process.exit(0);
      } else if (comparison.needsUpdate) {
        console.log('\n🆕 发现新的提交！');
        needsUpdate = true;
        updateInfo = { mode: UPGRADE_MODE.LATEST, commit: latestCommit };
      }
    } catch (error) {
      console.log('\n⚠️  无法获取最新 commit 信息:', error.message);
      console.log('将尝试升级到最新版本...\n');
      needsUpdate = true;
      updateInfo = { mode: UPGRADE_MODE.LATEST };
    }
  } else {
    // 检查最新 release
    console.log('检查模式: 稳定版 (默认)');
    console.log('提示: 使用 --latest 可检查最新开发版\n');
    
    try {
      const latestVersion = await getLatestVersion();
      console.log(`最新稳定版: v${latestVersion}`);
      
      const comparison = compareVersions(versionInfo.version, latestVersion);
      
      if (comparison >= 0) {
        console.log('\n✅ 已是最新稳定版！');
        process.exit(0);
      }
      
      console.log('\n🆕 发现新版本！');
      needsUpdate = true;
      updateInfo = { mode: UPGRADE_MODE.STABLE, version: latestVersion };
    } catch (error) {
      console.log('\n⚠️  无法获取最新版本信息:', error.message);
      console.log('将尝试升级到最新版本...\n');
      needsUpdate = true;
      updateInfo = { mode: UPGRADE_MODE.STABLE };
    }
  }
  
  if (!needsUpdate) {
    process.exit(0);
  }
  
  // 询问是否升级
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.question('是否立即升级？(y/N): ', async (answer) => {
    rl.close();
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      try {
        await performUpgrade();
      } catch (error) {
        console.error('\n升级过程中出错:', error.message);
        if (process.env.DEBUG) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    } else {
      console.log('\n已取消升级。');
      if (mode === UPGRADE_MODE.LATEST) {
        console.log('如需升级到最新开发版，请运行: cc-git-hook upgrade --latest');
      } else {
        console.log('如需升级到最新稳定版，请运行: cc-git-hook upgrade');
      }
      process.exit(0);
    }
  });
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('未处理的错误:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export {
  main,
  getLatestVersion,
  getLatestCommit,
  compareVersions,
  compareWithCommit,
  UPGRADE_MODE,
};

#!/usr/bin/env node

/**
 * 升级模块
 * 检查并自动升级工具到最新版本
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const version = require('./version');

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
 * 从 GitHub API 获取最新版本（通过 tags）
 * @returns {Promise<string|null>} 最新版本号
 */
function getLatestVersionFromTags() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/SundayDX/claude-code-git-hook/tags?per_page=10',
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
            const tags = JSON.parse(data);
            if (tags.length === 0) {
              reject(new Error('未找到版本标签'));
              return;
            }
            // 找到第一个版本标签（通常按时间倒序排列）
            // 移除 'v' 前缀（如果有）
            const version = tags[0].name.replace(/^v/, '');
            resolve(version);
          } catch (error) {
            reject(new Error('无法解析版本信息'));
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
 * 从 GitHub API 获取最新版本（优先使用 releases，回退到 tags）
 * @returns {Promise<string|null>} 最新版本号
 */
function getLatestVersion() {
  return new Promise((resolve, reject) => {
    // 首先尝试从 releases 获取
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
            // 移除 'v' 前缀（如果有）
            const version = release.tag_name.replace(/^v/, '');
            resolve(version);
          } catch (error) {
            reject(new Error('无法解析版本信息'));
          }
        } else if (res.statusCode === 404) {
          // 如果没有 releases，回退到使用 tags
          getLatestVersionFromTags()
            .then(resolve)
            .catch((tagError) => {
              // 如果 tags 也没有，提供更友好的错误信息
              reject(new Error('仓库中还没有创建任何发布版本或标签。请先在 GitHub 上创建 Release 或 Tag。'));
            });
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
 * 执行升级
 */
async function performUpgrade() {
  console.log('\n开始升级...');
  
  try {
    // 获取安装目录（参考 install.sh 的逻辑）
    const os = require('os');
    const installRoot = process.env.CC_GIT_HOOK_INSTALL_ROOT || path.join(os.homedir(), '.claude-code-git-hook');
    
    // 检查安装目录是否存在且是 git 仓库
    if (!fs.existsSync(installRoot)) {
      console.error('❌ 错误: 未找到安装目录:', installRoot);
      console.log('\n请先运行安装脚本:');
      console.log('  curl -fsSL https://raw.githubusercontent.com/SundayDX/claude-code-git-hook/main/scripts/install.sh | bash');
      process.exit(1);
    }
    
    const isGitRepo = fs.existsSync(path.join(installRoot, '.git'));
    
    if (isGitRepo) {
      // 如果是 git 仓库，使用 git pull（参考 install.sh）
      console.log('📥 检测到 git 仓库，正在更新...');
      try {
        execSync('git pull', { 
          cwd: installRoot, 
          stdio: 'inherit',
          encoding: 'utf8'
        });
        console.log('\n✅ 更新完成！');
        console.log('\n提示: 如果命令符号链接需要更新，请运行：');
        console.log(`  bash ${path.join(installRoot, 'scripts', 'install.sh')}`);
      } catch (error) {
        console.error('\n❌ Git pull 失败:', error.message);
        console.log('\n请手动运行以下命令：');
        console.log(`  cd ${installRoot}`);
        console.log('  git pull');
        process.exit(1);
      }
    } else {
      // 如果不是 git 仓库，提示用户重新安装
      console.log('⚠️  当前安装不是 git 仓库，无法自动升级。');
      console.log('\n请使用安装脚本重新安装：');
      console.log('  curl -fsSL https://raw.githubusercontent.com/SundayDX/claude-code-git-hook/main/scripts/install.sh | bash');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 升级失败:', error.message);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 检查更新...\n');
  
  const currentVersion = version.getVersion();
  console.log(`当前版本: v${currentVersion}`);
  
  // 直接执行升级（参考 install.sh，直接 git pull）
  // 询问是否升级
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.question('\n是否立即升级？(y/N): ', async (answer) => {
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
      console.log('如需升级，请运行: cc-git-hook upgrade');
      process.exit(0);
    }
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('未处理的错误:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = {
  main,
  getLatestVersion,
  compareVersions,
};


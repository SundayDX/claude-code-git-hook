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
 * 从 GitHub API 获取最新版本
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
            // 移除 'v' 前缀（如果有）
            const version = release.tag_name.replace(/^v/, '');
            resolve(version);
          } catch (error) {
            reject(new Error('无法解析版本信息'));
          }
        } else if (res.statusCode === 404) {
          reject(new Error('未找到发布版本'));
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
 * @param {string} latestVersion - 最新版本号
 */
async function performUpgrade(latestVersion) {
  console.log(`\n开始升级到 v${latestVersion}...`);
  
  try {
    // 获取当前脚本路径
    const currentScriptPath = __filename;
    const projectDir = path.resolve(__dirname, '..');
    
    // 检查是否是 git 仓库
    const isGitRepo = fs.existsSync(path.join(projectDir, '.git'));
    
    if (isGitRepo) {
      // 如果是 git 仓库，使用 git pull
      console.log('检测到 git 仓库，使用 git pull 升级...');
      try {
        execSync('git pull', { 
          cwd: projectDir, 
          stdio: 'inherit',
          encoding: 'utf8'
        });
        console.log('\n✅ 升级成功！');
        console.log('请运行以下命令重新安装：');
        console.log(`  bash ${path.join(projectDir, 'scripts', 'install.sh')}`);
      } catch (error) {
        console.error('\n❌ Git pull 失败:', error.message);
        console.log('\n请手动运行以下命令：');
        console.log(`  cd ${projectDir}`);
        console.log('  git pull');
        console.log(`  bash scripts/install.sh`);
        process.exit(1);
      }
    } else {
      // 如果不是 git 仓库，提示用户手动升级
      console.log('⚠️  当前安装不是 git 仓库，无法自动升级。');
      console.log('\n请使用以下方式升级：');
      console.log('\n方法一：使用安装脚本重新安装');
      console.log('  curl -fsSL https://raw.githubusercontent.com/SundayDX/claude-code-git-hook/main/scripts/install.sh | bash');
      console.log('\n方法二：从 GitHub 下载最新版本');
      console.log(`  https://github.com/SundayDX/claude-code-git-hook/releases/tag/v${latestVersion}`);
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
  
  try {
    const latestVersion = await getLatestVersion();
    console.log(`最新版本: v${latestVersion}`);
    
    const comparison = compareVersions(currentVersion, latestVersion);
    
    if (comparison < 0) {
      // 有新版本
      console.log('\n✨ 发现新版本！');
      console.log(`\n当前版本: v${currentVersion}`);
      console.log(`最新版本: v${latestVersion}`);
      
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
            await performUpgrade(latestVersion);
          } catch (error) {
            console.error('\n升级过程中出错:', error.message);
            process.exit(1);
          }
        } else {
          console.log('\n已取消升级。');
          console.log('如需升级，请运行: cc-git-hook upgrade');
          process.exit(0);
        }
      });
    } else if (comparison === 0) {
      // 已是最新版本
      console.log('\n✅ 已是最新版本！');
      process.exit(0);
    } else {
      // 当前版本更新（开发版本）
      console.log('\nℹ️  当前版本似乎比最新发布版本更新（可能是开发版本）');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ 检查更新失败:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    console.log('\n提示：请检查网络连接或稍后重试');
    process.exit(1);
  }
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


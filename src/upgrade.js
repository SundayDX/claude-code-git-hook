#!/usr/bin/env node

/**
 * 升级模块
 * 使用 npm update -g 升级全局安装的包
 */

import https from 'https';
import { execSync } from 'child_process';
import readline from 'readline';
import * as version from './version.js';

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
 * 执行升级
 */
async function performUpgrade() {
  console.log('\n开始升级...\n');
  
  try {
    // 使用 npm update -g 升级
    console.log('📦 正在升级 claude-code-git-hook...');
    
    try {
      // 先尝试从 GitHub 安装最新版
      console.log('📥 从 GitHub 获取最新版本...');
      
      // 创建临时目录
      const tempDir = execSync('mktemp -d', { encoding: 'utf8' }).trim();
      
      // 克隆仓库
      execSync(
        'git clone --depth 1 https://github.com/SundayDX/claude-code-git-hook.git .',
        { 
          cwd: tempDir,
          stdio: 'pipe'
        }
      );
      
      // 打包
      execSync('npm pack --silent', { cwd: tempDir, stdio: 'pipe' });
      
      // 获取包文件名
      const packageFile = execSync('ls claude-code-git-hook-*.tgz', {
        cwd: tempDir,
        encoding: 'utf8'
      }).trim();
      
      // 全局安装
      console.log('🔧 安装新版本...');
      execSync(`npm install -g "${tempDir}/${packageFile}"`, {
        stdio: 'inherit'
      });
      
      // 清理临时目录
      execSync(`rm -rf "${tempDir}"`);
      
      console.log('\n✅ 升级完成！');
      console.log(`\n当前版本: v${version.getVersion()}`);
    } catch (error) {
      console.error('\n❌ 从 GitHub 升级失败，尝试从 npm 升级...');
      
      // 回退到 npm update
      execSync('npm update -g claude-code-git-hook', {
        stdio: 'inherit'
      });
      
      console.log('\n✅ 升级完成！');
      console.log(`\n当前版本: v${version.getVersion()}`);
    }
  } catch (error) {
    console.error('\n❌ 升级失败:', error.message);
    console.log('\n请尝试手动升级：');
    console.log('  npm install -g claude-code-git-hook@latest');
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
    
    if (comparison >= 0) {
      console.log('\n✅ 已是最新版本！');
      process.exit(0);
    }
    
    console.log('\n🆕 发现新版本！');
  } catch (error) {
    console.log('\n⚠️  无法获取最新版本信息:', error.message);
    console.log('将尝试升级到最新版本...\n');
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
      console.log('如需升级，请运行: cc-git-hook upgrade');
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
  compareVersions,
};

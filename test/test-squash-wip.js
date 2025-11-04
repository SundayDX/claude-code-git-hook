#!/usr/bin/env node

/**
 * Squash WIP 命令测试脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIR = __dirname;
const PROJECT_DIR = path.join(TEST_DIR, '..');
const TEST_REPO_DIR = path.join(TEST_DIR, 'test-repo-squash');

/**
 * 执行命令
 */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      cwd: options.cwd || TEST_REPO_DIR,
      stdio: options.silent ? 'pipe' : 'inherit',
    });
  } catch (error) {
    if (!options.silent) {
      console.error('命令执行失败:', error.message);
    }
    throw error;
  }
}

/**
 * 设置测试环境
 */
function setupTestRepo() {
  console.log('🔧 设置测试仓库...');
  
  if (fs.existsSync(TEST_REPO_DIR)) {
    exec(`rm -rf "${TEST_REPO_DIR}"`, { cwd: TEST_DIR });
  }
  
  fs.mkdirSync(TEST_REPO_DIR, { recursive: true });
  
  exec('git init', { silent: true });
  exec('git config user.name "Test User"', { silent: true });
  exec('git config user.email "test@example.com"', { silent: true });
  
  // 创建初始 commit
  fs.writeFileSync(path.join(TEST_REPO_DIR, 'README.md'), '# Test Project\n');
  exec('git add README.md', { silent: true });
  exec('git commit -m "Initial commit"', { silent: true });
  
  // 创建多个 WIP commits
  for (let i = 1; i <= 3; i++) {
    fs.writeFileSync(path.join(TEST_REPO_DIR, `file${i}.js`), `// file ${i}\n`);
    exec(`git add file${i}.js`, { silent: true });
    exec(`git commit -m "[AUTO-WIP] 添加文件 ${i}"`, { silent: true });
  }
  
  console.log('✅ 测试仓库已创建（包含 3 个 WIP commits）\n');
}

/**
 * 测试 squash-wip 功能
 */
function testSquashWip() {
  console.log('📝 测试: Squash WIP 功能');
  
  try {
    // 记录初始 commit 数量
    const initialCommitCount = parseInt(exec('git log --oneline | wc -l', { silent: true }).trim());
    const initialCommits = exec('git log --oneline', { silent: true }).split('\n').filter(l => l);
    const wipCount = initialCommits.filter(c => c.includes('[AUTO-WIP]')).length;
    
    console.log(`   初始 commits: ${initialCommitCount}`);
    console.log(`   WIP commits: ${wipCount}`);
    
    if (wipCount === 0) {
      console.log('❌ 测试失败: 没有找到 WIP commits\n');
      return false;
    }
    
    // 运行 squash-wip（使用自定义消息）
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    
    try {
      const result = execSync(`node "${path.join(PROJECT_DIR, 'src/splash.js')}" "合并后的 commit 消息"`, {
        cwd: TEST_REPO_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      stdout = result.toString();
    } catch (error) {
      exitCode = error.status || error.code || 1;
      stdout = error.stdout ? error.stdout.toString() : '';
      stderr = error.stderr ? error.stderr.toString() : '';
      
      // 检查是否是正常的退出
      if (exitCode !== 0) {
        console.log('❌ Squash 命令执行失败');
        console.log(`   退出码: ${exitCode}`);
        if (stdout) {
          console.log(`   stdout: ${stdout.substring(0, 300)}`);
        }
        if (stderr) {
          console.log(`   stderr: ${stderr.substring(0, 300)}`);
        }
        console.log('');
        return false;
      }
    }
    
    const finalCommitCount = parseInt(exec('git log --oneline | wc -l', { silent: true }).trim());
    const lastCommitMsg = exec('git log -1 --pretty=%B', { silent: true }).trim();
    const lastCommitLog = exec('git log --oneline -1', { silent: true });
    
    console.log(`   最终 commits: ${finalCommitCount}`);
    console.log(`   最后 commit 消息: ${lastCommitMsg.substring(0, 50)}...`);
    
    // 应该只有 2 个 commits（初始 + 合并后的）
    // 验证：1. commit 数量正确 2. 消息包含自定义消息 3. 没有 [AUTO-WIP] 前缀
    if (finalCommitCount === 2 && 
        lastCommitMsg.includes('合并后的 commit 消息') &&
        !lastCommitLog.includes('[AUTO-WIP]')) {
      console.log('✅ Squash WIP 测试通过\n');
      return true;
    } else {
      console.log('❌ 测试失败');
      console.log(`   Commit 数量: ${finalCommitCount} (期望: 2)`);
      console.log(`   最后 commit: ${lastCommitMsg.substring(0, 100)}`);
      console.log(`   包含 [AUTO-WIP]: ${lastCommitLog.includes('[AUTO-WIP]')}`);
      console.log(`   包含自定义消息: ${lastCommitMsg.includes('合并后的 commit 消息')}\n`);
      return false;
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    console.log('');
    return false;
  }
}

/**
 * 测试 2: 无 WIP commits 时的行为
 */
function testNoWipCommits() {
  console.log('📝 测试 2: 无 WIP commits 时的行为');
  
  try {
    // 创建一个新的测试仓库，没有 WIP commits
    const testRepo2 = path.join(TEST_DIR, 'test-repo-no-wip');
    
    if (fs.existsSync(testRepo2)) {
      exec(`rm -rf "${testRepo2}"`, { cwd: TEST_DIR });
    }
    
    fs.mkdirSync(testRepo2, { recursive: true });
    exec('git init', { cwd: testRepo2, silent: true });
    exec('git config user.name "Test User"', { cwd: testRepo2, silent: true });
    exec('git config user.email "test@example.com"', { cwd: testRepo2, silent: true });
    
    fs.writeFileSync(path.join(testRepo2, 'README.md'), '# Test\n');
    exec('git add README.md', { cwd: testRepo2, silent: true });
    exec('git commit -m "Initial commit"', { cwd: testRepo2, silent: true });
    
    // 运行 squash-wip（应该退出，没有错误）
    try {
      execSync(`node "${path.join(PROJECT_DIR, 'src/splash.js')}"`, {
        cwd: testRepo2,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      
      // 如果执行到这里，说明脚本正常退出（没有 WIP commits）
      console.log('✅ 无 WIP commits 测试通过\n');
      
      // 清理
      exec(`rm -rf "${testRepo2}"`, { cwd: TEST_DIR });
      return true;
    } catch (error) {
      // 检查退出码，如果是 0 或正常退出，也是可以的
      if (error.status === 0 || error.code === 0) {
        console.log('✅ 无 WIP commits 测试通过（正常退出）\n');
        // 清理
        exec(`rm -rf "${testRepo2}"`, { cwd: TEST_DIR });
        return true;
      } else {
        console.log('❌ 测试失败: 应该正常退出\n');
        // 清理
        exec(`rm -rf "${testRepo2}"`, { cwd: TEST_DIR });
        return false;
      }
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message, '\n');
    return false;
  }
}

/**
 * 运行测试
 */
function runTests() {
  console.log('🧪 开始测试 Squash WIP...\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    setupTestRepo();
    
    if (testSquashWip()) {
      passed++;
    } else {
      failed++;
    }
    
    if (testNoWipCommits()) {
      passed++;
    } else {
      failed++;
    }
    
    // 输出结果
    console.log('─'.repeat(50));
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log('─'.repeat(50));
    
    if (failed > 0) {
      console.log('❌ 测试失败');
      process.exit(1);
    } else {
      console.log('✅ 所有测试通过');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ 测试环境设置失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };


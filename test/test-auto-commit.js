#!/usr/bin/env node

/**
 * 自动 commit hook 测试脚本
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIR = __dirname;
const PROJECT_DIR = path.join(TEST_DIR, '..');
const TEST_REPO_DIR = path.join(TEST_DIR, 'test-repo');

/**
 * 执行命令并返回结果
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
 * 运行 auto-commit 脚本并传递 JSON 输入
 */
function runAutoCommit(hookInput, options = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PROJECT_DIR, 'src/auto-commit.js');
    const input = JSON.stringify(hookInput);
    
    const child = spawn('node', [scriptPath], {
      cwd: options.cwd || TEST_REPO_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env || {}) },
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    let resolved = false;
    
    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        resolve({
          code,
          stdout,
          stderr,
        });
      }
    });
    
    child.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });
    
    // 写入输入并关闭 stdin
    child.stdin.write(input);
    child.stdin.end();
    
    // 设置超时，确保进程有时间处理
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          code: child.exitCode || 0,
          stdout,
          stderr,
        });
      }
    }, 2000);
  });
}

/**
 * 设置测试环境
 */
function setupTestRepo() {
  console.log('🔧 设置测试仓库...');
  
  // 清理旧仓库
  if (fs.existsSync(TEST_REPO_DIR)) {
    exec(`rm -rf "${TEST_REPO_DIR}"`, { cwd: TEST_DIR });
  }
  
  // 创建新仓库
  fs.mkdirSync(TEST_REPO_DIR, { recursive: true });
  
  exec('git init', { silent: true });
  exec('git config user.name "Test User"', { silent: true });
  exec('git config user.email "test@example.com"', { silent: true });
  
  // 创建初始文件
  fs.writeFileSync(path.join(TEST_REPO_DIR, 'README.md'), '# Test Project\n');
  exec('git add README.md', { silent: true });
  exec('git commit -m "Initial commit"', { silent: true });
  
  console.log('✅ 测试仓库已创建\n');
}

/**
 * 测试 1: 基本功能测试
 */
async function testBasicFunctionality() {
  console.log('📝 测试 1: 基本功能测试');
  
  try {
    // 确保测试仓库干净
    const statusBefore = exec('git status --porcelain', { silent: true });
    if (statusBefore.trim()) {
      // 如果有未提交的变更，先提交或重置
      exec('git reset --hard HEAD', { silent: true });
    }
    
    // 创建测试文件
    fs.writeFileSync(path.join(TEST_REPO_DIR, 'test.js'), 'console.log("test");\n');
    
    // 验证文件确实存在且有变更
    const statusAfter = exec('git status --porcelain', { silent: true });
    if (!statusAfter.includes('test.js')) {
      console.log('❌ 测试文件未检测到变更\n');
      return false;
    }
    
    // 记录初始 commit
    const initialCommit = exec('git rev-parse HEAD', { silent: true }).trim();
    
    // 模拟 hook 输入
    const hookInput = {
      prompt: '添加测试文件',
    };
    
    // 运行 auto-commit
    const result = await runAutoCommit(hookInput, {
      env: { DEBUG: '1', CLAUDE_GIT_HOOK_DEBUG: '1' },
    });
    
    // 等待一下确保 git 操作完成
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 检查是否有新 commit
    const currentCommit = exec('git rev-parse HEAD', { silent: true }).trim();
    
    if (initialCommit === currentCommit) {
      console.log('❌ 没有创建新的 commit');
      console.log(`   stdout: ${result.stdout}`);
      console.log(`   stderr: ${result.stderr}`);
      console.log(`   exit code: ${result.code}\n`);
      return false;
    }
    
    // 检查 commit 消息
    const log = exec('git log --oneline -1', { silent: true });
    const commitMsg = exec('git log -1 --pretty=%B', { silent: true });
    
    // 检查：1. 包含 [AUTO-WIP] 前缀 2. 消息包含测试相关的关键词（可能是 "测试文件" 或 "添加测试文件"）
    if (log.includes('[AUTO-WIP]') && 
        (commitMsg.includes('测试文件') || commitMsg.includes('添加测试文件'))) {
      console.log('✅ 基本功能测试通过\n');
      return true;
    } else {
      console.log('❌ Commit 消息格式不正确');
      console.log(`   实际消息: ${commitMsg.trim()}\n`);
      return false;
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message, '\n');
    return false;
  }
}

/**
 * 测试 2: 无变更时不应创建 commit
 */
async function testNoChanges() {
  console.log('📝 测试 2: 无变更时不应创建 commit');
  
  try {
    const initialCommit = exec('git rev-parse HEAD', { silent: true }).trim();
    
    // 运行 auto-commit（无变更）
    const result = await runAutoCommit({});
    
    const currentCommit = exec('git rev-parse HEAD', { silent: true }).trim();
    
    if (initialCommit === currentCommit) {
      console.log('✅ 无变更测试通过\n');
      return true;
    } else {
      console.log('❌ 不应该创建 commit');
      console.log(`   初始: ${initialCommit.substring(0, 7)}`);
      console.log(`   当前: ${currentCommit.substring(0, 7)}\n`);
      return false;
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message, '\n');
    return false;
  }
}

/**
 * 测试 3: 配置文件测试
 */
async function testConfigFile() {
  console.log('📝 测试 3: 配置文件测试');
  
  try {
    // 创建配置文件
    const config = {
      autoCommit: {
        enabled: true,
        prefix: '[TEST-WIP]',
      },
    };
    
    fs.writeFileSync(
      path.join(TEST_REPO_DIR, '.claude-git-hook.json'),
      JSON.stringify(config, null, 2)
    );
    
    // 创建测试文件
    fs.writeFileSync(path.join(TEST_REPO_DIR, 'test2.js'), '// test\n');
    
    // 运行 auto-commit
    const result = await runAutoCommit({ prompt: '测试配置文件' });
    
    const log = exec('git log --oneline -1', { silent: true });
    const commitMsg = exec('git log -1 --pretty=%B', { silent: true });
    
    if (log.includes('[TEST-WIP]') || commitMsg.includes('[TEST-WIP]')) {
      console.log('✅ 配置文件测试通过\n');
      // 清理配置文件
      fs.unlinkSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'));
      return true;
    } else {
      console.log('❌ 配置文件未生效');
      console.log(`   实际消息: ${commitMsg.trim()}\n`);
      // 清理配置文件
      if (fs.existsSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'))) {
        fs.unlinkSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'));
      }
      return false;
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message, '\n');
    // 清理配置文件
    if (fs.existsSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'))) {
      fs.unlinkSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'));
    }
    return false;
  }
}

/**
 * 测试 4: 禁用自动 commit 测试
 */
async function testDisabledAutoCommit() {
  console.log('📝 测试 4: 禁用自动 commit 测试');
  
  try {
    // 创建配置文件（禁用自动 commit）
    const config = {
      autoCommit: {
        enabled: false,
      },
    };
    
    fs.writeFileSync(
      path.join(TEST_REPO_DIR, '.claude-git-hook.json'),
      JSON.stringify(config, null, 2)
    );
    
    // 创建测试文件
    fs.writeFileSync(path.join(TEST_REPO_DIR, 'test3.js'), '// disabled test\n');
    
    const initialCommit = exec('git rev-parse HEAD', { silent: true }).trim();
    
    // 运行 auto-commit
    const result = await runAutoCommit({ prompt: '测试禁用功能' });
    
    const currentCommit = exec('git rev-parse HEAD', { silent: true }).trim();
    
    if (initialCommit === currentCommit) {
      console.log('✅ 禁用自动 commit 测试通过\n');
      // 清理配置文件
      fs.unlinkSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'));
      return true;
    } else {
      console.log('❌ 禁用功能未生效\n');
      // 清理配置文件
      if (fs.existsSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'))) {
        fs.unlinkSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'));
      }
      return false;
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message, '\n');
    // 清理配置文件
    if (fs.existsSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'))) {
      fs.unlinkSync(path.join(TEST_REPO_DIR, '.claude-git-hook.json'));
    }
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🧪 开始运行测试...\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    setupTestRepo();
    
    // 运行测试（使用 async/await）
    if (await testBasicFunctionality()) passed++; else failed++;
    if (await testNoChanges()) passed++; else failed++;
    if (await testConfigFile()) passed++; else failed++;
    if (await testDisabledAutoCommit()) passed++; else failed++;
    
  } catch (error) {
    console.error('❌ 测试环境设置失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  // 输出结果
  console.log('─'.repeat(50));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('─'.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ 测试运行失败:', error);
    process.exit(1);
  });
}

module.exports = { runTests };


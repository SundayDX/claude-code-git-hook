#!/usr/bin/env node

/**
 * 统一测试运行器
 * 运行所有测试文件并汇总结果
 */

const path = require('path');
const { execSync } = require('child_process');

const TEST_DIR = __dirname;

const tests = [
  {
    name: '自动 Commit 测试',
    file: path.join(TEST_DIR, 'test-auto-commit.js'),
  },
  {
    name: 'Squash WIP 测试',
    file: path.join(TEST_DIR, 'test-squash-wip.js'),
  },
];

async function runAllTests() {
  console.log('🧪 开始运行所有测试...\n');
  console.log('═'.repeat(60));
  console.log('');
  
  let totalPassed = 0;
  let totalFailed = 0;
  const results = [];
  
  for (const test of tests) {
    console.log(`\n📦 运行: ${test.name}`);
    console.log('─'.repeat(60));
    
    try {
      execSync(`node "${test.file}"`, {
        cwd: TEST_DIR,
        stdio: 'inherit',
        encoding: 'utf-8',
      });
      
      // 如果执行到这里，说明测试通过
      results.push({ name: test.name, status: 'passed' });
      totalPassed++;
    } catch (error) {
      // 测试失败
      results.push({ name: test.name, status: 'failed', error: error.message });
      totalFailed++;
    }
    
    console.log('');
  }
  
  // 输出汇总结果
  console.log('═'.repeat(60));
  console.log('\n📊 测试汇总\n');
  console.log('─'.repeat(60));
  
  results.forEach(result => {
    const icon = result.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.status === 'passed' ? '通过' : '失败'}`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  });
  
  console.log('─'.repeat(60));
  console.log(`\n总计: ${totalPassed} 通过, ${totalFailed} 失败`);
  console.log('═'.repeat(60));
  
  if (totalFailed > 0) {
    console.log('\n❌ 部分测试失败');
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  }
}

// 运行所有测试
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('❌ 测试运行器失败:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };


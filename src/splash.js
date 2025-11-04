#!/usr/bin/env node

/**
 * Claude Code Squash WIP 命令
 * 合并多个 [AUTO-WIP] commits 为一个正式 commit
 */

const { query } = require('@anthropic-ai/claude-code');
const gitUtils = require('./git-utils');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const logger = require('./logger').defaultLogger;

/**
 * 询问用户是否初始化 git 仓库
 * @returns {Promise<boolean>} 用户是否同意初始化
 */
function askToInitGitRepository() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('当前目录不是 git 仓库。是否要初始化 git 仓库？(y/n): ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * 构建用于生成合并 commit 消息的 prompt
 * @param {Array<Object>} wipCommits - WIP commit 列表
 * @returns {string} prompt 文本
 */
function buildMergedPrompt(wipCommits) {
  if (wipCommits.length === 0) {
    return null;
  }
  
  let prompt = `请根据以下多个 WIP commits 生成一个综合的、清晰的 commit 消息。\n\n`;
  prompt += `要求:\n`;
  prompt += `1. 消息应该简洁明了，准确概括所有 commits 的变更内容\n`;
  prompt += `2. 如果所有 commits 都是相关的修改，应该合并成一个统一的描述\n`;
  prompt += `3. 如果 commits 包含多个不同的修改，可以用列表形式列出主要修改点\n`;
  prompt += `4. 不要包含 [AUTO-WIP] 前缀\n`;
  prompt += `5. 只输出 commit 消息，不要包含其他解释或说明\n`;
  prompt += `6. 消息长度建议不超过 100 个字符（如果使用列表，可以适当延长）\n\n`;
  prompt += `WIP Commits:\n`;
  
  wipCommits.forEach((commit, index) => {
    const message = commit.message.replace(/^\[AUTO-WIP\]\s*/, '');
    const date = new Date(commit.date).toLocaleString('zh-CN');
    prompt += `${index + 1}. [${commit.hash.substring(0, 7)}] ${date}\n`;
    prompt += `   ${message}\n\n`;
  });
  
  return prompt;
}

/**
 * 使用 Claude Code SDK 生成合并后的 commit 消息
 * @param {Array<Object>} wipCommits - WIP commit 列表
 * @returns {Promise<string>} 合并后的 commit 消息
 */
async function generateMergedCommitMessage(wipCommits) {
  if (wipCommits.length === 0) {
    return '合并 WIP commits';
  }
  
  if (wipCommits.length === 1) {
    // 只有一个 commit，移除 [AUTO-WIP] 前缀
    return wipCommits[0].message.replace(/^\[AUTO-WIP\]\s*/, '');
  }
  
  const maxRetries = 3;
  const timeout = 30000;
  const prompt = buildMergedPrompt(wipCommits);
  
  if (!prompt) {
    return '合并 WIP commits';
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`🤖 正在生成合并 commit 消息 (尝试 ${attempt}/${maxRetries})...`);
      
      const result = await Promise.race([
        query(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
      
      // 清理返回的消息
      let message = result.trim();
      
      // 移除可能的前缀
      message = message.replace(/^\[AUTO-WIP\]\s*/i, '');
      
      // 移除多余的空行
      message = message.split('\n').filter(line => line.trim().length > 0).join('\n');
      
      if (message.length > 0) {
        return message;
      }
    } catch (error) {
      if (attempt === maxRetries) {
        // 最后一次尝试失败，使用后备方案
        logger.warn(`⚠️ 生成合并 commit 消息失败，使用后备方案: ${error.message}`);
        
        // 提取所有操作描述
        const descriptions = wipCommits.map(commit => {
          const msg = commit.message.replace(/^\[AUTO-WIP\]\s*/, '');
          return msg.replace(/\s*\([^)]+\)$/, '').trim();
        }).filter(desc => desc.length > 0);
        
        // 生成主标题（基于第一个描述）
        let mainTitle = descriptions[0] || '完成多项修改';
        
        // 如果描述太长，截断
        if (mainTitle.length > 50) {
          mainTitle = mainTitle.substring(0, 50) + '...';
        }
        
        // 生成详细描述
        const details = descriptions.slice(1).map(desc => `- ${desc}`).join('\n');
        
        if (details.length > 0) {
          return `${mainTitle}\n\n包含以下修改:\n${details}`;
        }
        
        return mainTitle;
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  // 如果所有尝试都失败，返回后备消息
  return '合并 WIP commits';
}

/**
 * 显示将要合并的 commits 预览
 * @param {Array<Object>} wipCommits - WIP commit 列表
 */
function showPreview(wipCommits) {
  if (wipCommits.length === 0) {
    console.log('没有找到 [AUTO-WIP] commits 需要合并。');
    return;
  }
  
  console.log(`\n找到 ${wipCommits.length} 个 [AUTO-WIP] commits:`);
  console.log('─'.repeat(60));
  
  wipCommits.forEach((commit, index) => {
    const date = new Date(commit.date).toLocaleString('zh-CN');
    const message = commit.message.replace(/^\[AUTO-WIP\]\s*/, '');
    console.log(`${index + 1}. [${commit.hash.substring(0, 7)}] ${date}`);
    console.log(`   ${message}`);
  });
  
  console.log('─'.repeat(60));
  console.log(`\n将合并为 1 个正式 commit。\n`);
}

/**
 * 执行交互式 rebase 合并
 * @param {string} baseCommit - 基准 commit hash
 * @param {Array<Object>} wipCommits - 要合并的 WIP commits
 * @param {string} commitMessage - 合并后的 commit 消息
 * @returns {boolean} 是否成功
 */
function performRebase(baseCommit, wipCommits, commitMessage) {
  if (wipCommits.length === 0) {
    return false;
  }
  
  // 计算需要 rebase 的 commit 数量
  const commitCount = wipCommits.length;
  
  // 创建临时文件用于 rebase 指令
  const rebaseScript = path.join(os.tmpdir(), `claude-code-splash-${Date.now()}.txt`);
  
  try {
    // 生成 rebase 指令
    // 第一个 commit 保持 pick，后续的改为 squash
    const rebaseInstructions = [];
    rebaseInstructions.push('pick'); // 第一个 commit
    
    for (let i = 1; i < commitCount; i++) {
      rebaseInstructions.push('squash');
    }
    
    // 写入 rebase 指令到临时文件
    const rebaseContent = rebaseInstructions.join('\n') + '\n';
    fs.writeFileSync(rebaseScript, rebaseContent);
    
    // 设置环境变量用于非交互式模式
    const env = {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `cat "${rebaseScript}" >`,
      GIT_EDITOR: `cat >`,
    };
    
    // 创建 commit 消息文件
    const commitMsgFile = path.join(os.tmpdir(), `claude-code-commit-msg-${Date.now()}.txt`);
    fs.writeFileSync(commitMsgFile, commitMessage);
    
    // 设置 EDITOR 环境变量用于编辑 commit 消息
    env.GIT_EDITOR = `cat "${commitMsgFile}" >`;
    
    // 执行 rebase
    const baseRef = baseCommit ? `${baseCommit}^` : 'HEAD~' + commitCount;
    
    try {
      execSync(`git rebase -i ${baseRef}`, {
        env,
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      
      return true;
    } catch (error) {
      // rebase 可能失败，检查是否需要手动处理
      logger.warn('\n警告: 自动 rebase 失败，可能需要手动处理。');
      logger.warn('错误信息:', error.message);
      return false;
    }
  } catch (error) {
    logger.error('错误: 执行 rebase 时出错:', error.message);
    return false;
  } finally {
    // 清理临时文件
    try {
      if (fs.existsSync(rebaseScript)) {
        fs.unlinkSync(rebaseScript);
      }
    } catch (error) {
      // 忽略清理错误
    }
  }
}

/**
 * 使用更简单的方法：reset + commit
 * 这种方法更可靠，不依赖交互式 rebase
 * @param {Array<Object>} wipCommits - 要合并的 WIP commits
 * @param {string} commitMessage - 合并后的 commit 消息
 * @returns {boolean} 是否成功
 */
function performSimpleMerge(wipCommits, commitMessage) {
  if (wipCommits.length === 0) {
    return false;
  }
  
  try {
    // 找到基准点（第一个 WIP commit 的前一个）
    const baseCommit = wipCommits[wipCommits.length - 1].hash;
    
    // 保存当前变更
    const hasChanges = gitUtils.getGitStatus().hasChanges;
    if (hasChanges) {
      logger.debug('检测到未提交的变更，先暂存...');
      gitUtils.execGitCommand('stash push -m "claude-code-splash-temp"', { silent: true });
    }
    
    // 软重置到第一个 WIP commit 之前
    const baseRef = `${baseCommit}^`;
    gitUtils.execGitCommand(`reset --soft ${baseRef}`, { silent: true });
    
    // 创建新的 commit
    gitUtils.execGitCommand(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
      silent: false,
    });
    
    // 恢复暂存的变更
    if (hasChanges) {
      try {
        gitUtils.execGitCommand('stash pop', { silent: true });
      } catch (error) {
        // stash pop 可能失败，但这不是致命错误
        logger.warn('警告: 恢复暂存变更时出现问题，请手动检查。');
      }
    }
    
    return true;
  } catch (error) {
    logger.error('错误: 合并 commits 失败:', error.message);
    return false;
  }
}

/**
 * 主函数
 * @param {string} [customMessage] - 自定义 commit 消息（可选）
 */
async function main(customMessage) {
  // 如果没有传入参数，从命令行参数读取（向后兼容）
  if (customMessage === undefined) {
    customMessage = process.argv.slice(2).join(' ').trim();
  }
  
  // 检查是否是 git 仓库
  if (!gitUtils.isGitRepository()) {
    // 询问用户是否初始化
    const shouldInit = await askToInitGitRepository();
    if (shouldInit) {
      if (gitUtils.initGitRepository()) {
        console.log('✅ 已初始化 git 仓库');
        // 继续执行后续流程
      } else {
        console.error('❌ 初始化 git 仓库失败');
        process.exit(1);
      }
    } else {
      // 用户拒绝初始化，退出
      console.log('未初始化 git 仓库，退出。');
      process.exit(1);
    }
  }
  
  // 查找基准 commit（最后一个非 WIP commit）
  const baseCommit = gitUtils.findLastNonWipCommit();
  
  if (!baseCommit) {
    console.log('没有找到基准 commit，将从 HEAD 开始查找。');
  }
  
  // 获取所有 WIP commits
  const allCommits = gitUtils.getRecentCommits(100);
  const wipCommits = [];
  let foundBase = baseCommit === null;
  
  for (const commit of allCommits) {
    if (baseCommit && commit.hash === baseCommit.hash) {
      foundBase = true;
      break;
    }
    
    if (commit.message.startsWith('[AUTO-WIP]')) {
      wipCommits.push(commit);
    }
  }
  
  // 如果没有找到基准，但找到了 WIP commits，仍然可以处理
  if (!foundBase && baseCommit) {
    console.log('警告: 未在最近的 commits 中找到基准点，将使用所有 WIP commits。');
  }
  
  // 显示预览
  showPreview(wipCommits);
  
  if (wipCommits.length === 0) {
    console.log('没有需要合并的 [AUTO-WIP] commits。');
    process.exit(0);
  }
  
  // 生成合并后的 commit 消息
  // 如果提供了自定义消息，使用自定义消息；否则使用 Claude Code SDK 生成
  let commitMessage;
  if (customMessage) {
    commitMessage = customMessage;
  } else {
    commitMessage = await generateMergedCommitMessage(wipCommits);
  }
  
  console.log('\n合并后的 commit 消息:');
  console.log('─'.repeat(60));
  console.log(commitMessage);
  console.log('─'.repeat(60));
  
  // 执行合并
  console.log('\n执行合并...');
  const success = performSimpleMerge(wipCommits, commitMessage);
  
  if (success) {
    console.log('\n✓ 成功合并 commits！');
    process.exit(0);
  } else {
    console.error('\n✗ 合并失败。');
    process.exit(1);
  }
}

// 如果直接运行此脚本（向后兼容）
if (require.main === module) {
  main().catch(error => {
    logger.error('未处理的错误:', error.message);
    if (process.env.DEBUG) {
      logger.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = {
  main,
  buildMergedPrompt,
  generateMergedCommitMessage,
  showPreview,
  performSimpleMerge,
};


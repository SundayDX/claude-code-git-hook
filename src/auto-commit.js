#!/usr/bin/env node

/**
 * Claude Code Auto-Commit Hook
 * 在 Stop 事件时自动创建 [AUTO-WIP] commit
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as gitUtils from './git-utils.js';
import * as config from './config.js';
import readline from 'readline';
import { defaultLogger as logger } from './logger.js';

/**
 * 构建用于生成 commit 消息的 prompt
 * @param {Object} hookInput - Hook 输入
 * @param {string} changes - Git 变更信息
 * @returns {string} prompt 文本
 */
function buildPrompt(hookInput, changes) {
  const appConfig = config.loadConfig();
  const prefix = appConfig.autoCommit.prefix || '[AUTO-WIP]';
  const userPrompt = hookInput.prompt || hookInput.user_prompt || '';
  
  let prompt = `请根据以下 git 变更信息生成一个简洁清晰的 commit 消息。\n\n`;
  
  if (userPrompt) {
    prompt += `用户操作描述: ${userPrompt}\n\n`;
  }
  
  prompt += `要求:\n`;
  prompt += `1. 消息必须以 "${prefix}" 开头\n`;
  prompt += `2. 消息应该简洁明了，准确描述本次变更\n`;
  prompt += `3. 如果提供了用户操作描述，应该基于它来生成消息\n`;
  prompt += `4. 只输出 commit 消息，不要包含其他解释或说明\n`;
  prompt += `5. 消息长度建议不超过 100 个字符\n\n`;
  prompt += `Git 变更信息:\n${changes}`;
  
  return prompt;
}

/**
 * 询问用户是否初始化 git 仓库（仅在交互式模式下）
 * @returns {Promise<boolean>} 用户是否同意初始化
 */
function askToInitGitRepository() {
  return new Promise((resolve) => {
    // 只在交互式模式下询问
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      resolve(false);
      return;
    }
    
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
 * 使用 Claude Agent SDK 生成 commit 消息
 * @param {Object} hookInput - Hook 输入
 * @param {string} changes - Git 变更信息
 * @returns {Promise<string>} commit 消息
 */
async function generateCommitMessage(hookInput, changes) {
  const appConfig = config.loadConfig();
  const prefix = appConfig.autoCommit.prefix || '[AUTO-WIP]';
  const maxRetries = 3;
  const timeout = 30000;
  
  logger.info('开始生成 commit 消息...');
  const prompt = buildPrompt(hookInput, changes);
  logger.debug(`Prompt 长度: ${prompt.length} 字符`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`🤖 正在调用 Claude Agent SDK 生成消息 (尝试 ${attempt}/${maxRetries})...`);
      
      const result = await Promise.race([
        query(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
      
      // 清理返回的消息
      let message = result.trim();
      
      // 确保消息以正确的前缀开头
      if (!message.startsWith(prefix)) {
        message = `${prefix} ${message}`;
      }
      
      // 移除可能的多余换行和空格
      message = message.split('\n')[0].trim();
      
      // 限制长度
      const maxLength = appConfig.autoCommit.maxMessageLength || 100;
      if (message.length > maxLength) {
        message = message.substring(0, maxLength - 3) + '...';
      }
      
      logger.info(`✓ 成功生成 commit 消息 (第 ${attempt} 次尝试)`);
      logger.debug(`消息内容: ${message}`);
      return message;
    } catch (error) {
      logger.warn(`⚠️ 第 ${attempt} 次尝试失败: ${error.message}`);
      
      if (attempt === maxRetries) {
        // 最后一次尝试失败，使用后备方案
        logger.warn(`⚠️ 所有尝试均失败，使用后备方案生成 commit 消息`);
        logger.debug(`错误详情: ${error.stack}`);
        
        const userPrompt = hookInput.prompt || hookInput.user_prompt || '';
        const timestamp = new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        
        if (userPrompt) {
          const desc = userPrompt.length > 50 ? userPrompt.substring(0, 50) + '...' : userPrompt;
          return `${prefix} ${desc}`;
        } else {
          return `${prefix} 自动保存 ${timestamp}`;
        }
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * 主函数：处理自动 commit
 */
function main() {
  // 读取 stdin JSON 输入
  let hookInput = {};
  
  try {
    // 检查 stdin 是否可用
    if (process.stdin.isTTY) {
      // 交互式终端，直接处理（测试模式）
      processHookInput({});
      return;
    }
    
    // 非交互式模式，读取 stdin
    const stdin = process.stdin;
    let data = '';
    
    stdin.setEncoding('utf8');
    stdin.resume(); // 确保 stdin 可读
    
    stdin.on('data', (chunk) => {
      data += chunk;
    });
    
    stdin.on('end', () => {
      try {
        if (data.trim().length > 0) {
          hookInput = JSON.parse(data);
        }
        
        processHookInput(hookInput);
      } catch (error) {
        // JSON 解析失败，使用空对象继续
        if (process.env.DEBUG) {
          logger.warn('警告: 无法解析 hook 输入 JSON:', error.message);
        }
        processHookInput({});
      }
    });
    
    stdin.on('error', (error) => {
      if (process.env.DEBUG) {
        logger.warn('警告: 读取 stdin 时出错:', error.message);
      }
      processHookInput({});
    });
    
    // 设置超时，如果 stdin 没有数据，直接处理
    setTimeout(() => {
      if (data.length === 0) {
        processHookInput({});
      }
    }, 100);
    
  } catch (error) {
    // 任何错误都不应该中断 Claude Code
    if (process.env.DEBUG) {
      logger.error('错误: 处理 hook 输入时出错:', error.message);
    }
    processHookInput({});
  }
}

/**
 * 处理 hook 输入并执行 commit
 * @param {Object} hookInput - Hook 输入对象
 */
async function processHookInput(hookInput) {
  try {
    logger.info('=== 开始处理 auto-commit ===');
    const appConfig = config.loadConfig();
    logger.debug(`配置已加载: autoCommit.enabled=${appConfig.autoCommit.enabled}`);
    
    // 检查是否启用自动 commit
    if (!appConfig.autoCommit.enabled) {
      logger.info('自动 commit 已禁用，退出');
      process.exit(0);
    }
    
    // 检查是否是 git 仓库
    logger.info('检查 git 仓库状态...');
    if (!gitUtils.isGitRepository()) {
      logger.warn('当前目录不是 git 仓库');
      // 不是 git 仓库
      // 如果是交互式模式，询问用户是否初始化
      if (process.stdin.isTTY && process.stdout.isTTY) {
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
          process.exit(0);
        }
      } else {
        // 非交互式模式（hook 调用），静默退出
        if (appConfig.debug.enabled) {
          logger.debug('当前目录不是 git 仓库');
        }
        process.exit(0);
      }
    }
    
    // 检查 git 状态
    logger.info('检查 git 变更状态...');
    const status = gitUtils.getGitStatus();
    logger.debug(`状态: hasChanges=${status.hasChanges}, staged=${status.staged}, unstaged=${status.unstaged}`);
    
    if (!status.hasChanges) {
      // 没有变更，不需要 commit
      logger.info('没有未提交的变更，退出');
      process.exit(0);
    }
    
    logger.info('检测到变更，继续处理...');
    
    // 暂存所有变更（在获取变更信息之前）
    try {
      if (appConfig.git.autoStage) {
        logger.info('暂存所有变更 (git add -A)...');
        gitUtils.execGitCommand('add -A', { 
          silent: !appConfig.debug.verbose,
        });
        logger.info('✓ 变更已暂存');
      }
    } catch (error) {
      logger.warn('警告: 暂存文件失败:', error.message);
      if (!appConfig.git.safeMode) {
        process.exit(1);
      }
      process.exit(0); // 不中断流程
    }
    
    // 获取完整的 git 变更信息
    logger.info('获取 git 变更信息...');
    let changes;
    try {
      changes = gitUtils.getGitChanges();
      logger.debug(`变更信息长度: ${changes.length} 字符`);
    } catch (error) {
      // 如果获取失败，使用简单的摘要
      logger.warn('警告: 获取 git 变更信息失败，使用简单摘要:', error.message);
      const filesSummary = gitUtils.getChangedFilesSummary();
      changes = `变更摘要: ${filesSummary || '未知变更'}`;
    }
    
    // 使用 Claude Agent SDK 生成 commit 消息
    const commitMessage = await generateCommitMessage(hookInput, changes);
    
    // 创建 commit
    logger.info('创建 git commit...');
    try {
      gitUtils.execGitCommand(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        silent: !appConfig.debug.verbose,
      });
      
      // 成功创建 commit
      logger.info(`✓ 已创建 commit: ${commitMessage}`);
    } catch (error) {
      // commit 失败可能是没有变更或已是最新状态
      logger.warn('警告: 创建 commit 失败:', error.message);
      if (!appConfig.git.safeMode) {
        process.exit(1);
      }
    }
    
    logger.info('=== auto-commit 完成 ===');
    process.exit(0);
  } catch (error) {
    // 任何错误都不应该中断 Claude Code
    logger.error('错误:', error.message);
    logger.debug(`错误堆栈: ${error.stack}`);
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  main,
  buildPrompt,
  generateCommitMessage,
  processHookInput,
};


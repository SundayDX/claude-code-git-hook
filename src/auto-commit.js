#!/usr/bin/env node

/**
 * Claude Code Auto-Commit Hook
 * 在 Stop 事件时自动创建 [AUTO-WIP] commit
 */

const { query } = require('@anthropic-ai/claude-code');
const gitUtils = require('./git-utils');
const config = require('./config');

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
 * 使用 Claude Code SDK 生成 commit 消息
 * @param {Object} hookInput - Hook 输入
 * @param {string} changes - Git 变更信息
 * @returns {Promise<string>} commit 消息
 */
async function generateCommitMessage(hookInput, changes) {
  const appConfig = config.loadConfig();
  const prefix = appConfig.autoCommit.prefix || '[AUTO-WIP]';
  const maxRetries = 3;
  const timeout = 30000;
  
  const prompt = buildPrompt(hookInput, changes);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (appConfig.debug.enabled) {
        console.log(`🤖 正在生成 commit 消息 (尝试 ${attempt}/${maxRetries})...`);
      }
      
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
      
      return message;
    } catch (error) {
      if (attempt === maxRetries) {
        // 最后一次尝试失败，使用后备方案
        if (appConfig.debug.enabled) {
          console.error(`⚠️ 生成 commit 消息失败，使用后备方案: ${error.message}`);
        }
        
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
          console.error('警告: 无法解析 hook 输入 JSON:', error.message);
        }
        processHookInput({});
      }
    });
    
    stdin.on('error', (error) => {
      if (process.env.DEBUG) {
        console.error('警告: 读取 stdin 时出错:', error.message);
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
      console.error('错误: 处理 hook 输入时出错:', error.message);
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
    const appConfig = config.loadConfig();
    
    // 检查是否启用自动 commit
    if (!appConfig.autoCommit.enabled) {
      if (appConfig.debug.enabled) {
        console.log('自动 commit 已禁用');
      }
      process.exit(0);
    }
    
    // 检查是否是 git 仓库
    if (!gitUtils.isGitRepository()) {
      // 不是 git 仓库，静默退出
      if (appConfig.debug.enabled) {
        console.log('当前目录不是 git 仓库');
      }
      process.exit(0);
    }
    
    // 检查 git 状态
    const status = gitUtils.getGitStatus();
    
    if (!status.hasChanges) {
      // 没有变更，不需要 commit
      if (appConfig.debug.enabled) {
        console.log('没有未提交的变更');
      }
      process.exit(0);
    }
    
    // 暂存所有变更（在获取变更信息之前）
    try {
      if (appConfig.git.autoStage) {
        gitUtils.execGitCommand('add -A', { 
          silent: !appConfig.debug.verbose,
        });
      }
    } catch (error) {
      if (appConfig.debug.enabled || !appConfig.git.safeMode) {
        console.error('警告: 暂存文件失败:', error.message);
      }
      if (!appConfig.git.safeMode) {
        process.exit(1);
      }
      process.exit(0); // 不中断流程
    }
    
    // 获取完整的 git 变更信息
    let changes;
    try {
      changes = gitUtils.getGitChanges();
    } catch (error) {
      // 如果获取失败，使用简单的摘要
      if (appConfig.debug.enabled) {
        console.error('警告: 获取 git 变更信息失败，使用简单摘要:', error.message);
      }
      const filesSummary = gitUtils.getChangedFilesSummary();
      changes = `变更摘要: ${filesSummary || '未知变更'}`;
    }
    
    // 使用 Claude Code SDK 生成 commit 消息
    const commitMessage = await generateCommitMessage(hookInput, changes);
    
    // 创建 commit
    try {
      gitUtils.execGitCommand(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        silent: !appConfig.debug.verbose,
      });
      
      // 成功创建 commit
      if (appConfig.debug.enabled) {
        console.log(`✓ 已创建 commit: ${commitMessage}`);
      }
    } catch (error) {
      // commit 失败可能是没有变更或已是最新状态
      if (appConfig.debug.enabled) {
        console.error('警告: 创建 commit 失败:', error.message);
      }
      if (!appConfig.git.safeMode) {
        process.exit(1);
      }
    }
    
    process.exit(0);
  } catch (error) {
    // 任何错误都不应该中断 Claude Code
    if (process.env.DEBUG) {
      console.error('错误:', error.message);
    }
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  main,
  buildPrompt,
  generateCommitMessage,
  processHookInput,
};


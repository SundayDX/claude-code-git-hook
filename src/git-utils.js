#!/usr/bin/env node

/**
 * Git 操作工具函数
 * 提供安全的 git 命令执行和状态检查功能
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * 检查当前目录是否是 git 仓库
 * @returns {boolean}
 */
function isGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 安全执行 git 命令
 * @param {string} command - git 命令（不包含 'git' 前缀）
 * @param {Object} options - 执行选项
 * @returns {string} 命令输出
 */
function execGitCommand(command, options = {}) {
  const { silent = false, cwd } = options;
  
  try {
    // 即使 silent 模式，也需要捕获输出用于处理
    // 使用 'pipe' 来捕获 stdout，但 silent 时只输出到 stderr
    const result = execSync(`git ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', silent ? 'ignore' : 'pipe'],
      cwd: cwd || process.cwd(),
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (!silent) {
      console.error(`Git 命令执行失败: git ${command}`);
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * 获取 git 状态（是否有未暂存的变更）
 * @returns {Object} { hasChanges: boolean, hasStaged: boolean, status: string }
 */
function getGitStatus() {
  if (!isGitRepository()) {
    return { hasChanges: false, hasStaged: false, status: 'not_a_repo' };
  }

  try {
    const status = execGitCommand('status --porcelain');
    const hasStaged = /^[AMDR]/.test(status);
    const hasChanges = status.length > 0;
    
    return {
      hasChanges,
      hasStaged,
      status: hasChanges ? status : 'clean',
    };
  } catch (error) {
    return { hasChanges: false, hasStaged: false, status: 'error' };
  }
}

/**
 * 获取变更统计信息
 * @returns {Object} { files: number, insertions: number, deletions: number, summary: string }
 */
function getDiffStat() {
  try {
    const stat = execGitCommand('diff --stat', { silent: true });
    const summary = execGitCommand('diff --stat --summary', { silent: true });
    
    // 解析统计信息
    const lines = stat.split('\n');
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/(\d+)\s+files?\s+changed.*?(\d+)\s+insertions?.*?(\d+)\s+deletions?/);
    
    if (match) {
      return {
        files: parseInt(match[1], 10),
        insertions: parseInt(match[2], 10),
        deletions: parseInt(match[3], 10),
        summary: stat,
      };
    }
    
    return {
      files: lines.length - 1,
      insertions: 0,
      deletions: 0,
      summary: stat,
    };
  } catch (error) {
    return {
      files: 0,
      insertions: 0,
      deletions: 0,
      summary: '',
    };
  }
}

/**
 * 获取变更的文件列表
 * @returns {Array<string>} 变更的文件路径列表
 */
function getChangedFiles() {
  try {
    const output = execGitCommand('diff --name-only', { silent: true });
    return output.split('\n').filter(line => line.trim().length > 0);
  } catch (error) {
    return [];
  }
}

/**
 * 获取变更的文件类型摘要
 * @returns {string} 文件类型摘要，如 "修改了 3 个文件，新增了 1 个文件"
 */
function getChangedFilesSummary() {
  try {
    // 使用 git status --porcelain 获取更准确的文件状态
    const status = execGitCommand('status --porcelain', { silent: true });
    if (!status || status.trim().length === 0) {
      return '';
    }

    const stats = {
      modified: 0,
      added: 0,
      deleted: 0,
    };

    const lines = status.split('\n').filter(line => line.trim().length > 0);
    
    lines.forEach(line => {
      // git status --porcelain 格式: XY filename
      // X: 暂存区状态, Y: 工作区状态
      // A: 新增, M: 修改, D: 删除
      const stagedStatus = line[0];
      const worktreeStatus = line[1];
      
      // 优先检查暂存区状态
      if (stagedStatus === 'A' || worktreeStatus === 'A') {
        stats.added++;
      } else if (stagedStatus === 'D' || worktreeStatus === 'D') {
        stats.deleted++;
      } else if (stagedStatus === 'M' || worktreeStatus === 'M' || 
                 stagedStatus === 'R' || stagedStatus === 'C') {
        stats.modified++;
      } else {
        // 未知状态，默认为修改
        stats.modified++;
      }
    });

    const parts = [];
    if (stats.added > 0) parts.push(`新增了 ${stats.added} 个文件`);
    if (stats.modified > 0) parts.push(`修改了 ${stats.modified} 个文件`);
    if (stats.deleted > 0) parts.push(`删除了 ${stats.deleted} 个文件`);

    return parts.join('，');
  } catch (error) {
    // 如果失败，使用简单的文件计数
    try {
      const files = getChangedFiles();
      if (files.length > 0) {
        return `变更了 ${files.length} 个文件`;
      }
    } catch (e) {
      // 忽略错误
    }
    return '';
  }
}

/**
 * 获取最近的 commit 列表
 * @param {number} count - 获取的数量
 * @param {string} pattern - 匹配模式（可选）
 * @returns {Array<Object>} commit 对象数组 { hash, message, date }
 */
function getRecentCommits(count = 10, pattern = null) {
  try {
    let command = `log --format="%H|%s|%ai" -n ${count}`;
    if (pattern) {
      command += ` --grep="${pattern}"`;
    }
    
    const output = execGitCommand(command, { silent: true });
    const commits = output.split('\n').filter(line => line.trim().length > 0);
    
    return commits.map(line => {
      const [hash, ...messageParts] = line.split('|');
      const message = messageParts.slice(0, -1).join('|');
      const date = messageParts[messageParts.length - 1];
      
      return {
        hash: hash.trim(),
        message: message.trim(),
        date: date.trim(),
      };
    });
  } catch (error) {
    return [];
  }
}

/**
 * 查找第一个非 [AUTO-WIP] commit
 * @returns {Object|null} commit 对象或 null
 */
function findLastNonWipCommit() {
  try {
    const commits = getRecentCommits(50);
    
    for (const commit of commits) {
      if (!commit.message.startsWith('[AUTO-WIP]')) {
        return commit;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 获取从指定 commit 到 HEAD 的所有 [AUTO-WIP] commits
 * @param {string} baseCommit - 基准 commit hash
 * @returns {Array<Object>} WIP commit 列表
 */
function getWipCommitsSince(baseCommit) {
  try {
    const commits = getRecentCommits(100);
    const wipCommits = [];
    let foundBase = false;
    
    for (const commit of commits) {
      if (commit.hash === baseCommit) {
        foundBase = true;
        break;
      }
      
      if (commit.message.startsWith('[AUTO-WIP]')) {
        wipCommits.push(commit);
      }
    }
    
    return foundBase ? wipCommits : [];
  } catch (error) {
    return [];
  }
}

/**
 * 获取完整的 git 变更信息（用于生成 commit 消息）
 * 参考 claude-auto-commit 的实现
 * @returns {string} 格式化的变更信息
 */
function getGitChanges() {
  try {
    // 执行 git 命令获取变更信息
    const status = execGitCommand('status --porcelain', { silent: true });
    const branch = execGitCommand('branch --show-current', { silent: true });
    
    if (!status || !status.trim()) {
      throw new Error('No changes detected');
    }
    
    let changes = `Branch: ${branch.trim()}\n\nStatus:\n${status}\n\n`;
    
    // 获取已暂存和未暂存的文件
    let diffStaged = '';
    let diffUnstaged = '';
    
    try {
      diffStaged = execGitCommand('diff --cached --name-only', { silent: true });
    } catch (error) {
      // 忽略错误，可能没有暂存的文件
    }
    
    try {
      diffUnstaged = execGitCommand('diff --name-only', { silent: true });
    } catch (error) {
      // 忽略错误
    }
    
    if (diffStaged && diffStaged.trim()) {
      changes += `Staged files:\n${diffStaged}\n`;
      try {
        const stagedStat = execGitCommand('diff --cached --stat', { silent: true });
        changes += `\nStaged changes summary:\n${stagedStat}\n\n`;
      } catch (error) {
        changes += `\nStaged changes: (too large to display)\n\n`;
      }
    }
    
    if (diffUnstaged && diffUnstaged.trim()) {
      changes += `Unstaged files:\n${diffUnstaged}\n`;
      try {
        const unstagedStat = execGitCommand('diff --stat', { silent: true });
        changes += `\nUnstaged changes summary:\n${unstagedStat}\n`;
      } catch (error) {
        changes += `\nUnstaged changes: (too large to display)\n`;
      }
    }
    
    // 如果内容太大，截断
    if (changes.length > 4000) {
      changes = changes.substring(0, 4000) + '\n... (truncated for brevity)';
    }
    
    return changes;
  } catch (error) {
    throw new Error(`Failed to get git changes: ${error.message}`);
  }
}

module.exports = {
  isGitRepository,
  execGitCommand,
  getGitStatus,
  getDiffStat,
  getChangedFiles,
  getChangedFilesSummary,
  getRecentCommits,
  findLastNonWipCommit,
  getWipCommitsSince,
  getGitChanges,
};


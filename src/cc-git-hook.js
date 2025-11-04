#!/usr/bin/env node

/**
 * Claude Code Git Hook Tool - 统一入口
 * 支持二级命令结构
 */

import path from 'path';

// 命令映射 (使用动态 import)
const commands = {
  'squash-wip': () => import('./splash.js'),
  'auto-commit': () => import('./auto-commit.js'),
  'doctor': () => import('./doctor.js'),
  'version': () => import('./version.js'),
  'upgrade': () => import('./upgrade.js'),
  'config': () => import('./config-cmd.js'),
};

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Claude Code Git Hook Tool

用法:
  cc-git-hook <command> [options]

命令:
  squash-wip [message]  合并多个 [AUTO-WIP] commits 为一个正式 commit
  auto-commit           手动运行 auto-commit（通常由 hook 自动调用）
  doctor                 诊断工具，检查安装和配置状态
  version                显示当前版本号
  upgrade                检查并升级到最新版本
  config                 配置管理命令（查看和设置配置项）
  help                   显示此帮助信息

示例:
  cc-git-hook squash-wip                 # 自动生成合并消息
  cc-git-hook squash-wip "实现用户认证"   # 使用自定义消息
  cc-git-hook doctor                      # 检查安装状态
  cc-git-hook version                     # 显示版本号
  cc-git-hook upgrade                     # 检查并升级
  cc-git-hook config set logging.level debug  # 设置日志级别
  cc-git-hook config get logging.level       # 查看日志级别

更多信息请访问: https://github.com/SundayDX/claude-code-git-hook
`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 如果没有参数或第一个参数是 help，显示帮助
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // 检查命令是否存在
  if (!commands[command]) {
    console.error(`错误: 未知命令 "${command}"`);
    console.error('');
    console.error('运行 "cc-git-hook help" 查看可用命令');
    process.exit(1);
  }

  // 加载对应的命令模块
  try {
    const commandModule = await commands[command]();
    
    if (!commandModule || typeof commandModule.main !== 'function') {
      console.error(`错误: 命令 "${command}" 模块未导出 main 函数`);
      process.exit(1);
    }

    // 根据命令类型调用对应的函数
    if (command === 'auto-commit') {
      // auto-commit 从 stdin 读取数据，不需要参数
      commandModule.main();
    } else if (command === 'squash-wip') {
      // squash-wip 接受可选的自定义消息参数
      const customMessage = commandArgs.join(' ').trim() || undefined;
      await commandModule.main(customMessage);
    } else if (command === 'doctor' || command === 'version') {
      // doctor 和 version 不需要参数
      commandModule.main();
    } else if (command === 'upgrade') {
      // upgrade 是异步的
      await commandModule.main();
    } else if (command === 'config') {
      // config 命令传递参数数组
      commandModule.main(...commandArgs);
    } else {
      // 其他命令：直接调用，传递参数数组
      commandModule.main(...commandArgs);
    }
  } catch (error) {
    console.error(`错误: 执行命令 "${command}" 时出错:`, error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 如果是直接执行，运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('未处理的错误:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { main };


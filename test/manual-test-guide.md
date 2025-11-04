# 手动测试指南

本指南说明如何手动测试 Claude Code Git Hook Tool 的各项功能。

## 准备工作

### 1. 设置测试环境

```bash
# 运行测试环境设置脚本
bash test/test-setup.sh

# 或手动创建测试仓库
mkdir test-repo
cd test-repo
git init
git config user.name "Test User"
git config user.email "test@example.com"
echo "# Test" > README.md
git add README.md
git commit -m "Initial commit"
```

### 2. 配置 Claude Code Hook（可选）

如果你想测试完整的 hook 流程，需要配置 Claude Code：

```bash
# 在项目根目录创建 .claude/settings.json
mkdir -p .claude
cp examples/claude-settings.json .claude/settings.json

# 修改路径为实际路径
# 将 "$CLAUDE_PROJECT_DIR/src/auto-commit.js" 
# 改为实际的脚本路径
```

## 测试场景

### 场景 1: 自动 Commit Hook 测试

**目标**: 测试自动创建 WIP commit 功能

**步骤**:

1. 在测试仓库中创建或修改文件：
   ```bash
   cd test-repo
   echo "console.log('test');" > test.js
   ```

2. 模拟 hook 输入并运行 auto-commit：
   ```bash
   echo '{"prompt": "添加测试文件"}' | node ../src/auto-commit.js
   ```

3. 验证结果：
   ```bash
   git log --oneline -1
   # 应该看到 [AUTO-WIP] 开头的 commit
   
   git status
   # 应该显示 clean（所有文件已提交）
   ```

**预期结果**:
- ✅ 自动创建了 `[AUTO-WIP]` commit
- ✅ Commit 消息包含操作描述
- ✅ 文件已自动暂存并提交

### 场景 2: 无变更时不应创建 Commit

**目标**: 测试无变更时的行为

**步骤**:

1. 记录当前 commit：
   ```bash
   git rev-parse HEAD > /tmp/before.txt
   ```

2. 运行 auto-commit（无变更）：
   ```bash
   echo '{}' | node ../src/auto-commit.js
   ```

3. 验证 commit 未改变：
   ```bash
   git rev-parse HEAD > /tmp/after.txt
   diff /tmp/before.txt /tmp/after.txt
   # 应该没有差异
   ```

**预期结果**:
- ✅ 没有创建新的 commit
- ✅ Git 状态未改变

### 场景 3: 配置文件测试

**目标**: 测试配置文件功能

**步骤**:

1. 创建配置文件：
   ```bash
   cat > .claude-git-hook.json <<EOF
   {
     "autoCommit": {
       "prefix": "[TEST-WIP]",
       "maxMessageLength": 50
     }
   }
   EOF
   ```

2. 创建测试文件并运行：
   ```bash
   echo "test" > test2.js
   echo '{"prompt": "测试配置文件"}' | node ../src/auto-commit.js
   ```

3. 验证配置生效：
   ```bash
   git log --oneline -1
   # 应该看到 [TEST-WIP] 前缀
   ```

**预期结果**:
- ✅ Commit 消息使用自定义前缀
- ✅ 消息长度符合配置限制

### 场景 4: Squash WIP 命令测试

**目标**: 测试合并 WIP commits 功能

**步骤**:

1. 创建多个 WIP commits：
   ```bash
   cd test-repo
   for i in 1 2 3; do
     echo "file $i" > file$i.js
     git add file$i.js
     git commit -m "[AUTO-WIP] 添加文件 $i"
   done
   ```

2. 查看 commits：
   ```bash
   git log --oneline
   # 应该看到 4 个 commits（初始 + 3 个 WIP）
   ```

3. 运行 squash-wip：
   ```bash
   node ../src/splash.js "合并后的 commit 消息"
   ```

4. 验证结果：
   ```bash
   git log --oneline
   # 应该只有 2 个 commits（初始 + 合并后的）
   
   git log -1 --pretty=%B
   # 应该显示合并后的消息
   ```

**预期结果**:
- ✅ 多个 WIP commits 被合并为一个
- ✅ 合并后的 commit 消息正确
- ✅ Git 历史干净整洁

### 场景 5: 在 Claude Code 中测试

**目标**: 测试完整的集成流程

**步骤**:

1. 配置 Claude Code hook（见准备工作）

2. 在 Claude Code 中：
   - 进行一些代码修改
   - 等待对话结束（或点击停止）
   - 检查是否自动创建了 WIP commit

3. 使用 slash 命令：
   ```
   /squash-wip 完成功能开发
   ```

4. 验证结果：
   ```bash
   git log --oneline
   git log -1 --pretty=%B
   ```

**预期结果**:
- ✅ Hook 自动创建 WIP commits
- ✅ Slash 命令成功合并 commits

## 调试技巧

### 启用调试模式

```bash
# 环境变量方式
DEBUG=1 node src/auto-commit.js

# 或使用配置文件
# 在 .claude-git-hook.json 中设置 "debug.enabled": true
```

### 查看详细日志

```bash
# 设置详细日志
export DEBUG=1
export CLAUDE_GIT_HOOK_DEBUG=1

# 运行命令
echo '{"prompt": "test"}' | node src/auto-commit.js
```

### 检查 Git 状态

```bash
# 查看所有 commits
git log --oneline --all

# 查看文件变更
git status
git diff

# 查看最近 commit
git show HEAD
```

## 常见问题

### Q: Hook 没有执行？

A: 检查：
1. `.claude/settings.json` 配置是否正确
2. 脚本路径是否正确
3. 脚本是否有执行权限
4. 使用 `claude --debug` 查看日志

### Q: Commit 消息不正确？

A: 检查：
1. Hook 输入的 JSON 格式
2. 配置文件是否正确
3. 启用调试模式查看处理过程

### Q: Squash 命令失败？

A: 检查：
1. 当前是否在 git 仓库中
2. 是否有未提交的变更
3. 是否有 WIP commits 需要合并

## 清理测试环境

```bash
# 删除测试仓库
rm -rf test-repo
rm -rf test-repo-squash

# 清理配置文件
rm -f .claude-git-hook.json
```


---
name: error-patterns
description: 常见错误模式速查 - 编译错误、运行时错误、测试失败、CI/CD 故障的根因分析和速修方案，让 build-fix Agent 秒级定位问题
version: 1.0.0
author: auto-cli
tags: [error, debugging, patterns, build-fix, troubleshooting, python, go, rust, java, node]
---

# Error Patterns -- 常见错误模式速查

> build-fix Agent 自动加载此知识库，快速定位错误根因并修复。

## 错误分类体系

### 1. Node.js / JavaScript 编译错误

| 错误关键词                             | 根因                                   | 速修方案                           |
| -------------------------------------- | -------------------------------------- | ---------------------------------- |
| `Cannot find module`                   | 模块未安装或路径错误                   | `npm install` 或检查 import 路径   |
| `Unexpected token`                     | 语法错误（括号/引号不匹配）            | 检查最近编辑的文件第 N 行          |
| `Cannot use import statement`          | 使用 ESM 语法但未设 `"type": "module"` | package.json 加 `"type": "module"` |
| `ERR_MODULE_NOT_FOUND`                 | ESM import 路径缺少 `.js` 后缀         | 所有相对 import 加 `.js` 扩展名    |
| `ReferenceError: X is not defined`     | 变量未声明或作用域错误                 | 检查变量声明和 import              |
| `SyntaxError: Unexpected end of input` | 缺少闭合括号/花括号                    | 检查最近编辑区域的括号匹配         |
| `ERR_PACKAGE_PATH_NOT_EXPORTED`        | 包的 exports 字段不包含此路径          | 检查包版本或换 import 路径         |

### 2. 测试框架错误

| 错误关键词                            | 根因                            | 速修方案                           |
| ------------------------------------- | ------------------------------- | ---------------------------------- |
| `vitest: TESTS_FAILED`                | 测试断言不通过                  | 逐个检查失败断言                   |
| `TypeError: X is not a function`      | mock 未正确设置                 | 检查 `vi.mock()` 或 `vi.fn()` 配置 |
| `Cannot read properties of undefined` | 测试数据缺少字段                | 补全测试 fixture 的必需字段        |
| `Timeout - Async test`                | 异步操作未 await 或缺少 cleanup | 加 `await` 或 `vi.useFakeTimers()` |
| `ENOENT: no such file`                | 测试文件引用的 fixture 不存在   | 检查 `__fixtures__/` 路径          |
| ` vitest --coverage fails`            | `@vitest/coverage-v8` 未安装    | `npm i -D @vitest/coverage-v8`     |

### 3. Git / CI 错误

| 错误关键词                      | 根因                     | 速修方案                       |
| ------------------------------- | ------------------------ | ------------------------------ |
| `Merge conflict`                | 两个分支修改同一文件     | 手动解决冲突或 `git mergetool` |
| `Permission denied (publickey)` | SSH key 未配置           | `ssh-keygen` + 添加到 GitHub   |
| `GH009: Protected branch`       | 直接 push 到受保护分支   | 创建 PR 或换目标分支           |
| `Husky pre-commit failed`       | 提交钩子检查不通过       | 修复 lint/test 错误后重试      |
| `npm ERR! 403 Forbidden`        | npm 包名已被占用或无权限 | 换包名或检查 npm 登录状态      |

### 4. Claude Code 特有错误

| 错误关键词                | 根因               | 速修方案                 |
| ------------------------- | ------------------ | ------------------------ |
| `Context window exceeded` | 对话上下文过长     | 执行 `/clear` 或开新会话 |
| `Tool call failed`        | 工具调用参数错误   | 检查工具参数格式         |
| `Agent timeout`           | 子 Agent 执行超时  | 简化任务或增大 timeout   |
| `MCP server disconnected` | MCP 服务器进程崩溃 | 检查 MCP 配置和 API Key  |

### 5. 跨平台问题

| 错误关键词                       | 根因                     | 速修方案                         |
| -------------------------------- | ------------------------ | -------------------------------- |
| `EACCES: permission denied`      | Linux/Mac 文件权限       | `chmod` 或换安装目录             |
| `EPERM: operation not permitted` | Windows 文件被占用       | 关闭编辑器或用 `--force`         |
| `spawn X ENOENT`                 | 系统命令不存在           | 安装对应工具或检查 PATH          |
| `long path issues`               | Windows 260 字符路径限制 | `git config core.longpaths true` |

### 6. Java / Spring Boot 错误

| 错误关键词                    | 根因                             | 速修方案                                       |
| ----------------------------- | -------------------------------- | ---------------------------------------------- |
| `Cannot resolve symbol`       | 依赖未导入或 Maven/Gradle 未同步 | `mvn clean install` 或 IDEA 重新导入           |
| `NullPointerException`        | 未做空值检查或 Bean 未注入       | 检查 `@Autowired` 和 `@Nullable`               |
| `BeanCreationException`       | Spring Bean 配置错误或循环依赖   | 检查 `@ComponentScan` 和 `@Qualifier`          |
| `TransactionSystemException`  | `@Transactional` 回滚异常        | 检查 `rollbackFor = Exception.class`           |
| `HttpMessageNotReadable`      | JSON 反序列化失败                | 检查 DTO 字段类型和 `@JsonFormat`              |
| `DataIntegrityViolation`      | 数据库约束冲突（唯一键/外键）    | 检查数据唯一性和关联关系                       |
| `OutOfMemoryError: Metaspace` | 类加载器泄漏或元空间不足         | `-XX:MaxMetaspaceSize=512m`                    |
| `MyBatisSystemException`      | Mapper XML 与接口不匹配          | 检查 namespace、方法签名、`#{}` 参数           |
| `InvalidDefinitionException`  | Jackson 序列化配置错误           | 检查 `@JsonIgnore`、无参构造器                 |
| `StackOverflowError`          | 递归调用或双向引用序列化         | `@JsonManagedReference` + `@JsonBackReference` |

### 7. Python 错误

| 错误关键词                     | 根因                          | 速修方案                                             |
| ------------------------------ | ----------------------------- | ---------------------------------------------------- |
| `ImportError: No module named` | 模块未安装或不在 sys.path     | `pip install <module>` 或检查 `__init__.py`          |
| `ModuleNotFoundError`          | 虚拟环境不一致                | `pip install -r requirements.txt` 或重建 venv        |
| `TypeError: 'NoneType' object` | 函数返回 None 未处理          | 添加 `if result is None` 检查                        |
| `KeyError: 'xxx'`              | 字典键不存在                  | 使用 `dict.get('key', default)`                      |
| `AttributeError: 'NoneType'`   | 链式调用中间为 None           | 使用 `obj?.method()` 或 `getattr(obj, 'attr', None)` |
| `IndentationError`             | 缩进不一致（混用 Tab 和空格） | 统一使用 4 空格，运行 `autopep8 --in-place`          |
| `SyntaxError: invalid syntax`  | 括号/引号不匹配或版本不兼容   | 检查 Python 版本和 f-string 语法                     |
| `RecursionError`               | 递归深度超过限制              | `sys.setrecursionlimit()` 或改为迭代                 |
| `UnicodeDecodeError`           | 编码不一致                    | `open(file, encoding='utf-8')`                       |
| `TypeError: unhashable type`   | 用列表/字典做 dict 的 key     | 转为 `tuple` 或 `frozenset`                          |

### 8. Go 错误

| 错误关键词                            | 根因                       | 速修方案                                 |
| ------------------------------------- | -------------------------- | ---------------------------------------- |
| `undefined: xxx`                      | 包未导入或变量未导出       | `goimports -w .` 自动补 import           |
| `imported and not used`               | 导入但未使用               | 删除未使用的 import                      |
| `cannot use xxx as type yyy`          | 类型不匹配                 | 添加类型转换 `xxx.(Type)` 或检查接口实现 |
| `declared but not used`               | 变量声明但未使用           | 使用 `_ = variable` 或删除               |
| `syntax error: unexpected`            | 语法错误（缺少括号/逗号）  | 检查最近编辑区域                         |
| `cannot refer to unexported name`     | 引用了小写开头的私有标识符 | 改用导出的（大写开头）函数/类型          |
| `non-name xxx on left side of :=`     | 短变量声明左侧不是新变量   | 使用 `=` 替代 `:=`                       |
| `go: module xxx: no matching version` | 依赖版本不存在             | `go get xxx@latest` 或检查 go.sum        |

### 9. Rust 错误

| 错误关键词                                | 根因                 | 速修方案                         |
| ----------------------------------------- | -------------------- | -------------------------------- |
| `E0433: failed to resolve`                | 路径/模块不存在      | 检查 `use` 路径和 `mod` 声明     |
| `E0277: the trait bound is not satisfied` | 类型未实现所需 trait | 实现 trait 或使用 `.into()` 转换 |
| `E0308: mismatched types`                 | 类型不匹配           | 添加显式类型注解或 `as` 转换     |
| `E0382: use of moved value`               | 所有权已转移         | 使用 `.clone()` 或传引用 `&`     |
| `E0499: cannot borrow as mutable`         | 多次可变借用         | 重构借用作用域或使用 `RefCell`   |
| `E0601: main function not found`          | 缺少 main 函数       | 确认 `src/main.rs` 存在          |
| `cannot find type xxx in scope`           | 类型未导入           | 检查 `use` 和 `pub` 可见性       |
| `borrow of moved value`                   | 移动后使用           | 使用 `.clone()` 或 `Rc/Arc`      |

### 10. TypeScript 编译错误

| 错误代码 | 关键词             | 根因                       | 修复                              |
| -------- | ------------------ | -------------------------- | --------------------------------- |
| TS2322   | 类型不可分配       | 类型推断不匹配             | 添加类型断言或修正接口定义        |
| TS2307   | 找不到模块         | 模块路径错误或缺少类型声明 | 安装 @types/ 包或修正 import 路径 |
| TS2304   | 找不到名称         | 未导入或缺少声明           | 添加 import 或声明文件            |
| TS2554   | 参数数量错误       | 函数调用参数不匹配         | 检查函数签名，修正参数            |
| TS2345   | 参数类型不兼容     | 传入参数类型与声明不符     | 使用类型断言或修正调用方          |
| TS2694   | 命名空间无导出成员 | 接口/类型未导出            | 添加 export 关键字                |
| TS18046  | 值可能为 undefined | 缺少 null 检查             | 添加可选链 `?.` 或空值检查        |
| TS2740   | 缺少必要属性       | 对象字面量缺少必需字段     | 补充缺失属性或使用 Partial<T>     |
| TS2323   | 不能重新导出类型   | re-export 冲突             | 使用 `export type { ... }` 替代   |
| TS2589   | 类型实例过深       | 递归类型或复杂泛型         | 简化类型定义或使用断言            |

## 修复策略模板

当 build-fix Agent 遇到错误时，按以下优先级尝试：

1. **精确匹配**：在上方表格中搜索错误关键词
2. **模式匹配**：提取错误文件名+行号，Read 该位置，分析根因
3. **依赖检查**：`npm ls` 检查依赖树是否完整
4. **版本回退**：`git stash` 暂存改动，验证是否是最近引入的
5. **搜索引擎**：通过 brave-search/tavily MCP 搜索错误信息

## 与 auto-cli 集成

- `/auto:build-fix` 自动加载此知识库
- quest-designer 在设计 Quest 时可参考反模式警告
- hooks 中的 TypeScript 检查和 Prettier 自动修复可参考此知识库

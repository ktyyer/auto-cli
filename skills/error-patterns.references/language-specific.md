# Error Patterns — 语言特定错误速查

> 从 `error-patterns.md` 拆分。按需加载：Java → Section 1, Python → Section 2, Go → Section 3, Rust → Section 4, TypeScript → Section 5。

## 1. Java / Spring Boot 错误

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

## 2. Python 错误

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

## 3. Go 错误

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

## 4. Rust 错误

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

## 5. TypeScript 编译错误

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

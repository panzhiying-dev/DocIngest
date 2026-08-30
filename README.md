# document-ingestion

独立、轻量的文档向量入库 CLI。读取上游 Document Package v1 的 `document.md` 与 `document.json`，完成：

```text
document.md + document.json -> Loader -> Chunk -> Qwen Embedding -> Milvus
```

本项目不负责 PDF 解析、OCR、文本纠错、AI 改写、检索、Rerank、LLM 对话或 Web API。

## 目录

- [功能](#功能)
- [项目结构](#项目结构)
- [输入数据](#输入数据)
- [安装与运行](#安装与运行)
- [配置](#配置)
- [处理流程](#处理流程)
- [Chunk 策略](#chunk-策略)
- [Milvus Schema](#milvus-schema)
- [幂等与续传](#幂等与续传)
- [错误处理](#错误处理)
- [测试](#测试)
- [License](#license)

## 功能

- 扫描 `data/input/*/` 并加载 Markdown 与 JSON
- 使用 LangChain `RecursiveCharacterTextSplitter` 切分
- 使用 Qwen OpenAI-compatible Embedding API 批量生成向量
- 自动创建并校验 Milvus Collection
- 通过稳定 Chunk ID 实现幂等 Upsert
- 单个文档失败后继续处理其他文档
- 支持 `--input` 覆盖输入目录

## 项目结构

```text
document-ingestion/
├── src/
│   ├── chunker/document-chunker.ts
│   ├── config/index.ts
│   ├── embedding/
│   │   ├── embedding-provider.ts
│   │   └── qwen-embedding.ts
│   ├── loader/document-loader.ts
│   ├── pipeline/ingestion-pipeline.ts
│   ├── storage/
│   │   ├── milvus-store.ts
│   │   └── vector-store.ts
│   ├── types.ts
│   └── index.ts
├── data/input/demo/
├── tests/
├── .env.example
├── LICENSE
├── package.json
├── pnpm-lock.yaml
├── README.md
└── tsconfig.json
```

## 输入数据

默认输入目录为 `data/input/`。每个文档目录必须包含：

```text
data/input/
└── doc_xxx/
    ├── document.md
    ├── document.json
    └── assets/
```

`assets/` 当前不会参与 Chunk 或 Embedding。Markdown 是主要内容来源，JSON 用于提供 metadata。

Loader 优先读取以下 JSON 字段：

| 字段 | 用途 |
| --- | --- |
| `identity.document_id` | 文档 ID |
| `metadata.title` | 文档标题 |
| `metadata.category` | 文档分类 |
| `source.relative_path` / `source.file_name` | 源文件路径 |
| `structure.page_count` | 页数 |
| `quality.score` | 质量评分 |

缺少字段时会回退到 Markdown frontmatter，不会将整个 JSON 原样写入 Chunk。

## 安装与运行

要求 Node.js 20+ 和 pnpm，并在项目根目录执行：

```bash
pnpm install
cp .env.example .env
pnpm run ingest
pnpm run ingest --input ./data/input
```

示例文档位于 `data/input/demo/`。真实运行需要可访问的 Qwen 和 Milvus。

## 配置

```env
QWEN_API_KEY=your-qwen-api-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_EMBEDDING_MODEL=text-embedding-v3

MILVUS_ADDRESS=localhost:19530
MILVUS_TOKEN=
MILVUS_COLLECTION=document_chunks

CHUNK_SIZE=800
CHUNK_OVERLAP=120
EMBEDDING_BATCH_SIZE=16
EMBEDDING_MAX_RETRIES=3
EMBEDDING_DIMENSION=1024
INPUT_DIR=./data/input
```

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `QWEN_API_KEY` | 是 | - | Qwen / DashScope API Key |
| `QWEN_BASE_URL` | 否 | DashScope 地址 | OpenAI-compatible API 地址 |
| `QWEN_EMBEDDING_MODEL` | 否 | `text-embedding-v3` | Embedding 模型名 |
| `MILVUS_ADDRESS` | 是 | - | 例如 `localhost:19530` |
| `MILVUS_TOKEN` | 否 | 空 | 本地 Milvus 可为空 |
| `MILVUS_COLLECTION` | 否 | `document_chunks` | Collection 名称 |
| `EMBEDDING_DIMENSION` | 是 | - | 模型实际输出维度 |
| `CHUNK_SIZE` | 否 | `800` | Chunk 最大字符数 |
| `CHUNK_OVERLAP` | 否 | `120` | Chunk 重叠字符数 |
| `EMBEDDING_BATCH_SIZE` | 否 | `16` | 单次请求文本数 |
| `EMBEDDING_MAX_RETRIES` | 否 | `3` | 请求最大重试次数 |
| `INPUT_DIR` | 否 | `./data/input` | 默认输入目录 |

`EMBEDDING_DIMENSION` 必须与实际 Qwen 模型输出维度一致。程序不会猜测维度；已存在的 Milvus Collection 也会校验维度。

## 处理流程

1. **Loader**：扫描目录，读取 `document.md` 和 `document.json`，组合为 `SourceDocument`。
2. **Chunker**：使用 `RecursiveCharacterTextSplitter` 切分 Markdown，不 OCR、不清洗、不纠错、不改写。
3. **Embedding**：通过 `@langchain/openai` 的 `embedDocuments` 批量请求 Qwen。
4. **Storage**：创建/校验 Milvus Collection 并执行 Upsert。

各模块通过接口协作：Loader 不访问数据库，Chunker 不调用 Qwen，Embedding 不操作文件，Pipeline 不直接调用 Milvus SDK。

## Chunk 策略

分隔优先级为 Markdown 标题、空行段落、换行、中文句末标点、空格和字符。默认参数：

```env
CHUNK_SIZE=800
CHUNK_OVERLAP=120
```

Chunk ID 按文档 ID 和顺序稳定生成，例如 `doc_demo_c001`、`doc_demo_c002`。相同文档使用相同切分参数时会生成相同 ID。

## Milvus Schema

Collection 不存在时自动创建，并为 `embedding` 建立 COSINE AUTOINDEX。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `VarChar` 主键 | 使用 `chunkId` |
| `document_id` / `chunk_id` | `VarChar` | 文档与 Chunk ID |
| `content` | `VarChar` | 原始 Chunk 文本 |
| `embedding` | `FloatVector` | Qwen 向量 |
| `title` / `category` / `source_file` | `VarChar` | metadata |
| `page_start` / `page_end` | `Int64` | 页码范围 |

## 幂等与续传

主键使用稳定 Chunk ID。重复运行时，Milvus `upsert` 会覆盖已有记录，不会产生重复数据。

Qwen 配额耗尽或网络中断后，修复配置即可重新运行 `pnpm run ingest`。已成功写入的数据保留，失败文档会再次尝试；当前版本会重新请求已成功文档的 Embedding，但不会重复生成 Milvus 记录。

## 错误处理

程序会处理缺失文件、JSON 格式错误、空 Markdown、缺失 `document_id`、Qwen API/额度错误、Embedding 数量不一致以及 Milvus 连接或 Upsert 失败。单文档失败会记录文档 ID、阶段和原因，并继续处理其他文档；Collection 初始化失败属于全局错误。

## 测试

测试使用 mock Embedding 和 VectorStore，不调用真实外部服务：

```bash
pnpm typecheck
pnpm test
```

覆盖 Loader、Chunker、稳定 Chunk ID、metadata 传递、Pipeline 编排和单文档失败续行。

## License

本项目基于 [MIT License](./LICENSE) 发布，详见 [LICENSE](./LICENSE)。

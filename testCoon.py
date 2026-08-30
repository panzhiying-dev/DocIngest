import os
from dotenv import load_dotenv
from pymilvus import MilvusClient

# 加载 .env
load_dotenv()

milvus_address = os.getenv("MILVUS_ADDRESS")
milvus_token = os.getenv("MILVUS_TOKEN")

if not milvus_address:
    raise RuntimeError("MILVUS_ADDRESS 未配置")

# 自动补充协议
if not milvus_address.startswith(("http://", "https://")):
    milvus_address = f"http://{milvus_address}"

client = MilvusClient(
    uri=milvus_address,
    token=milvus_token or None,
)

print("Milvus:", milvus_address)

print(client.list_collections())

print(
    client.query(
        collection_name="document_chunks",
        filter="",
        output_fields=["*"],
        limit=5,
    )
)
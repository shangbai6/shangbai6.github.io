import requests
import os
import numpy as np
import json
import time
from typing import List, Tuple, Optional

# ----------------------- 配置与全局状态 -----------------------
Q_TEXT_FILE = "qtexts.json"   # 存储历史灵感文本
QLI_FILE    = "qli.json"      # 存储文本向量
QVLI_FILE   = "qvli.json"     # 存储权重

# ----- 读取历史数据 -----
def load_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

qtexts = load_json(Q_TEXT_FILE, [])
qli    = load_json(QLI_FILE, [])
qvli   = load_json(QVLI_FILE, [])

# ----------------------- 核心函数 -----------------------
def e(text: str) -> Optional[List[float]]:
    api_key = os.getenv("DASHSCOPE_API_KEY")
    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": "text-embedding-v4", "input": text}
    resp = requests.post(url, json=payload, headers=headers)
    if resp.status_code == 200:
        return resp.json()["data"][0]["embedding"]
    else:
        print(f"[嵌入错误] {resp.status_code}: {resp.text}")
        return None

# 余弦相似度
def coss(a: List[float], b: List[float]) -> float:
    a = np.array(a)
    b = np.array(b)
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))

# 预处理函数 (tq): 提取关键词和数学细节
def tq(question: str) -> dict:
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-test",
    }
    system_prompt = (
        "你是一个精准的数学与知识助手。请严格按照以下 JSON 格式回答用户问题，"
        "不要添加任何额外的解释、标记或对话：\n"
        "{\n"
        '  "keywords": ["关键词1", "关键词2"],\n'
        '  "mathematical_details": "所有相关的数学概念"\n'
        "}\n"
    )
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        "stream": False,
    }
    resp = requests.post(url, headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"keywords": [], "mathematical_details": content}

# 调用 DeepSeek 生成答案（带灵感提示）
def deepseek_answer(question: str, inspiration: Optional[str] = None, max_tokens: int = 8192) -> Tuple[str, int]:
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-test",
    }
    system_content = "你是一个知识渊博的助手，请根据灵感提示（如果有）详细回答用户问题。"
    messages = [{"role": "system", "content": system_content}]
    if inspiration:
        messages.append({"role": "user", "content": f"[灵感提示] {inspiration}\n\n[问题] {question}"})
    else:
        messages.append({"role": "user", "content": question})

    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": False,
    }
    resp = requests.post(url, headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json()
    answer = data["choices"][0]["message"]["content"]
    completion_tokens = data["usage"]["completion_tokens"]
    return answer, completion_tokens

# 总结函数
def summarize(text: str) -> str:
    details = tq(text)
    return details.get("mathematical_details", text[:200])

# ----------------------- 主交互逻辑 -----------------------
def process_question(question: str):
    global qtexts, qli, qvli

    print(f"\n[用户问题] {question}")
    _ = tq(question)

    q_vec = e(question)
    if q_vec is None:
        print("问题嵌入失败，放弃本次提问。")
        return

    if qli:
        similarities = []
        for i, vec in enumerate(qli):
            sim = coss(q_vec, vec)
            weighted_sim = sim * qvli[i]
            similarities.append((weighted_sim, i))
        similarities.sort(key=lambda x: x[0], reverse=True)
        candidate_indices = [idx for _, idx in similarities]
    else:
        candidate_indices = []

    answer = None
    final_inspiration_idx = None
    for idx in candidate_indices:
        inspiration_text = qtexts[idx]
        print(f"[尝试灵感 #{idx}] {inspiration_text[:100]}...")
        ans, tokens = deepseek_answer(question, inspiration_text, max_tokens=8192)
        if tokens > 8000:
            print(f"推理 token 数 {tokens} 超过 8000，惩罚该项权重（×0.9），尝试下一个灵感。")
            qvli[idx] *= 0.9
            save_json(QVLI_FILE, qvli)
            continue
        else:
            print(f"推理完成，使用灵感 #{idx}，token 数 {tokens}，奖励该项权重（×1.1）。")
            qvli[idx] *= 1.1
            save_json(QVLI_FILE, qvli)
            answer = ans
            final_inspiration_idx = idx
            break

    if answer is None:
        print("无可用灵感或所有灵感失败，直接回答。")
        answer, tokens = deepseek_answer(question, max_tokens=8192)

    print("\n[DeepSeek 回答]")
    print(answer)

    if final_inspiration_idx is not None or (answer is not None and tokens <= 8000):
        if answer is not None and tokens <= 8000:
            summary_text = summarize(answer)
            print(f"[新总结添加] {summary_text[:100]}...")
            vec = e(summary_text)
            if vec is not None:
                qtexts.append(summary_text)
                qli.append(vec)
                qvli.append(1.0)
                save_json(Q_TEXT_FILE, qtexts)
                save_json(QLI_FILE, qli)
                save_json(QVLI_FILE, qvli)
            else:
                print("总结嵌入失败，未添加至历史库。")
    else:
        print("本次回答因 token 超限或推理失败，不纳入历史库。")

# ----------------------- 交互循环 -----------------------
if __name__ == "__main__":
    print("=== 交互式智能问答系统 ===")
    print("输入 'exit' 或 'quit' 退出。")
    while True:
        try:
            user_input = input("\n请输入问题: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            break
        if user_input.lower() in ("exit", "quit"):
            break
        if not user_input:
            continue
        process_question(user_input)

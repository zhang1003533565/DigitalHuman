from __future__ import annotations

import argparse
import json
import time
import uuid
from pathlib import Path
from typing import Any

import requests


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a lightweight RAG regression set.")
    parser.add_argument("--base-url", default="http://127.0.0.1:18755", help="AI service base URL")
    parser.add_argument("--cases", default=str(Path(__file__).with_name("eval_cases.json")), help="Eval cases JSON path")
    args = parser.parse_args()

    cases = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    results = [run_case(args.base_url.rstrip("/"), case) for case in cases]
    passed = sum(1 for item in results if item["passed"])

    print(json.dumps({
        "passed": passed,
        "total": len(results),
        "passRate": round(passed / len(results), 4) if results else 0,
        "results": results,
    }, ensure_ascii=False, indent=2))


def run_case(base_url: str, case: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    payload = {
        "question": case["question"],
        "interest": case.get("interest"),
        "topK": case.get("topK", 5),
        "sessionId": case.get("sessionId") or f"eval-{case['id']}",
        "traceId": f"eval-{case['id']}-{uuid.uuid4()}",
    }
    response = requests.post(f"{base_url}/rag/query", json=payload, timeout=120)
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    response.raise_for_status()
    data = response.json()
    answer = data.get("answer") or ""
    expected = case.get("expectKeywords") or []
    missing = [keyword for keyword in expected if keyword not in answer]
    chunks = data.get("chunks") or []
    sources = data.get("sources") or []
    citation_issues = data.get("citationIssues") or []
    return {
        "id": case["id"],
        "passed": not missing,
        "missingKeywords": missing,
        "durationMs": duration_ms,
        "traceId": data.get("traceId"),
        "promptVersion": data.get("promptVersion"),
        "providerStatus": data.get("providerStatus"),
        "providerError": data.get("providerError"),
        "lowConfidence": data.get("lowConfidence"),
        "lowConfidenceReason": data.get("lowConfidenceReason"),
        "retrievalAttempts": data.get("retrievalAttempts"),
        "retrievedChunks": len(chunks),
        "sourceCount": len(sources),
        "topScore": chunks[0].get("score") if chunks else None,
        "citationsValid": data.get("citationsValid"),
        "citationIssues": citation_issues,
        "contextSufficient": data.get("contextSufficient"),
        "qualityPassed": data.get("qualityPassed"),
        "answerPreview": answer[:160],
    }


if __name__ == "__main__":
    main()

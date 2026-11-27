"""
Exemplo de uso no Predictor (pseudo-código — adapte à sua classe base Vertex / FastAPI).
"""
from typing import Any

from schemas import ChatCompletionRequest


def predict_instances(instances: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not instances:
        return [{"error": "empty instances"}]

    raw = instances[0]
    try:
        req = ChatCompletionRequest.model_validate(raw)
    except Exception as e:
        return [{"error": f"invalid payload: {e}"}]

    # TODO: chamar o modelo Gemma / pipeline real com req.messages, req.tools, etc.
    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    return [
        {
            "prediction": {
                "role": "assistant",
                "content": f"(stub) Echo: {last_user[:200]}",
            }
        }
    ]


# Formato de resposta Vertex: {"predictions": [ ... ]}
def wrap_vertex_response(predictions: list[Any]) -> dict[str, Any]:
    return {"predictions": predictions}

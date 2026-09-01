from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    model: str = "local-marketplace"
    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = False

    @field_validator("model")
    @classmethod
    def validate_model(cls, value: str) -> str:
        if value != "local-marketplace":
            raise ValueError("only the local-marketplace model is available")
        return value

    @field_validator("stream")
    @classmethod
    def validate_stream(cls, value: bool) -> bool:
        if value:
            raise ValueError("streaming is not supported by this POC")
        return value


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1)
    client_label: str = Field(default="dashboard-simulator", min_length=1, max_length=100)

    @field_validator("prompt", "client_label")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class EndpointCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=8, max_length=500)
    model_name: str = Field(default="tinyllama", min_length=1, max_length=200)

    @field_validator("name", "model_name")
    @classmethod
    def strip_value(cls, value: str) -> str:
        return value.strip()

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("base_url must start with http:// or https://")
        return normalized

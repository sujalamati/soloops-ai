from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["software", "office_supplies", "travel", "meals", "utilities", "marketing", "professional_services", "equipment", "other"]

class ExpenseExtracted(BaseModel):
    merchant: str | None = Field(max_length=255)
    expense_date: date | None
    currency: str | None = Field(min_length=3, max_length=3)
    subtotal: Decimal | None = Field(ge=0)
    tax: Decimal | None = Field(ge=0)
    total: Decimal | None = Field(ge=0)
    category: Category | None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value):
        return value.upper() if value else value

class ExpensePatch(BaseModel):
    merchant: str | None = Field(default=None, max_length=255)
    expense_date: date | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    subtotal: Decimal | None = Field(default=None, ge=0)
    tax: Decimal | None = Field(default=None, ge=0)
    total: Decimal | None = Field(default=None, ge=0)
    category: Category | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value):
        return value.upper() if value else value

class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    original_filename: str
    raw_text: str | None
    merchant: str | None
    expense_date: date | None
    currency: str | None
    subtotal: Decimal | None
    tax: Decimal | None
    total: Decimal | None
    category: str | None
    status: str
    review_reasons: list[str]
    processing_error: str | None
    created_at: datetime
    updated_at: datetime

class UploadItemResult(BaseModel):
    id: int | None
    filename: str
    status: str
    message: str

class HealthOut(BaseModel):
    status: str
    app: str
    ollama_reachable: bool
    model: str

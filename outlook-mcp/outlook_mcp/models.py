"""
Pydantic input models for all Outlook MCP tools.

Each tool gets a dedicated input model with Field constraints,
descriptions, and validators.
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# --- Enums ---

class BodyFormat(str, Enum):
    """Email body format."""
    TEXT = "text"
    HTML = "html"


class Importance(str, Enum):
    """Email importance level."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class FlagStatus(str, Enum):
    """Email flag status."""
    NOT_FLAGGED = "notFlagged"
    FLAGGED = "flagged"
    COMPLETE = "complete"


class WellKnownFolder(str, Enum):
    """Well-known Outlook folder names."""
    INBOX = "inbox"
    SENT = "sentitems"
    DRAFTS = "drafts"
    DELETED = "deleteditems"
    JUNK = "junkemail"
    ARCHIVE = "archive"


# --- Tier 1: Read Operations ---

class SearchEmailsInput(BaseModel):
    """Input for searching emails via KQL syntax."""
    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(
        ...,
        description=(
            "Search query using KQL syntax. Examples: "
            "'from:john', 'subject:invoice', 'hasAttachments:true', "
            "'from:boss@company.com AND subject:urgent'"
        ),
        min_length=1,
        max_length=500,
    )
    folder: Optional[str] = Field(
        default=None,
        description="Folder name or ID to search within. Use well-known names: inbox, sentitems, drafts, deleteditems, junkemail, archive. Default: all folders.",
    )
    limit: int = Field(default=20, ge=1, le=50, description="Max results to return.")
    offset: int = Field(default=0, ge=0, description="Skip this many results for pagination.")

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Search query cannot be empty")
        return v.strip()


class ReadEmailInput(BaseModel):
    """Input for reading a single email by ID."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(
        ..., description="The email message ID from a previous search or list result.", min_length=1
    )
    body_format: BodyFormat = Field(
        default=BodyFormat.TEXT,
        description="Body format: 'text' for plain text or 'html' for HTML.",
    )


class ListEmailsInput(BaseModel):
    """Input for listing emails in a folder."""
    model_config = ConfigDict(str_strip_whitespace=True)

    folder: str = Field(
        default="inbox",
        description="Folder name or ID. Well-known: inbox, sentitems, drafts, deleteditems, junkemail, archive.",
    )
    limit: int = Field(default=20, ge=1, le=50, description="Max results to return.")
    offset: int = Field(default=0, ge=0, description="Skip this many results for pagination.")
    unread_only: bool = Field(default=False, description="Filter to unread emails only.")


class ListFoldersInput(BaseModel):
    """Input for listing mail folders."""
    model_config = ConfigDict(str_strip_whitespace=True)

    limit: int = Field(default=50, ge=1, le=100, description="Max folders to return.")


# --- Tier 2: Action Operations ---

class SendEmailInput(BaseModel):
    """Input for sending a new email."""
    model_config = ConfigDict(str_strip_whitespace=True)

    to: List[str] = Field(
        ..., description="Recipient email addresses.", min_length=1
    )
    subject: str = Field(..., description="Email subject line.", min_length=1, max_length=500)
    body: str = Field(..., description="Email body content.", min_length=1)
    body_type: BodyFormat = Field(default=BodyFormat.TEXT, description="Body format: 'text' or 'html'.")
    cc: Optional[List[str]] = Field(default=None, description="CC recipient email addresses.")
    importance: Importance = Field(default=Importance.NORMAL, description="Email importance: low, normal, high.")
    save_to_sent: bool = Field(default=True, description="Save a copy to Sent Items.")

    @field_validator("to", "cc")
    @classmethod
    def validate_emails(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        for email in v:
            if "@" not in email or "." not in email.split("@")[-1]:
                raise ValueError(f"Invalid email address: {email}")
        return v


class ReplyEmailInput(BaseModel):
    """Input for replying to an email."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(..., description="ID of the email to reply to.", min_length=1)
    body: str = Field(..., description="Reply body content.", min_length=1)
    body_type: BodyFormat = Field(default=BodyFormat.TEXT, description="Body format: 'text' or 'html'.")
    reply_all: bool = Field(default=False, description="Reply to all recipients instead of just sender.")


class ForwardEmailInput(BaseModel):
    """Input for forwarding an email."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(..., description="ID of the email to forward.", min_length=1)
    to: List[str] = Field(..., description="Forward recipient email addresses.", min_length=1)
    comment: Optional[str] = Field(default=None, description="Optional comment to add above forwarded content.")

    @field_validator("to")
    @classmethod
    def validate_emails(cls, v: List[str]) -> List[str]:
        for email in v:
            if "@" not in email or "." not in email.split("@")[-1]:
                raise ValueError(f"Invalid email address: {email}")
        return v


class DraftEmailInput(BaseModel):
    """Input for creating a draft email (not sent)."""
    model_config = ConfigDict(str_strip_whitespace=True)

    to: List[str] = Field(..., description="Recipient email addresses.", min_length=1)
    subject: str = Field(..., description="Email subject line.", min_length=1, max_length=500)
    body: str = Field(..., description="Email body content.", min_length=1)
    body_type: BodyFormat = Field(default=BodyFormat.TEXT, description="Body format.")
    cc: Optional[List[str]] = Field(default=None, description="CC recipients.")
    importance: Importance = Field(default=Importance.NORMAL, description="Email importance.")


class MoveEmailInput(BaseModel):
    """Input for moving an email to a different folder."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(..., description="ID of the email to move.", min_length=1)
    destination_folder: str = Field(
        ...,
        description="Destination folder name or ID. Well-known: inbox, sentitems, drafts, deleteditems, junkemail, archive.",
        min_length=1,
    )


# --- Tier 3: Organization Operations ---

class MarkReadInput(BaseModel):
    """Input for marking email(s) as read or unread."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(..., description="ID of the email to update.", min_length=1)
    is_read: bool = Field(default=True, description="True to mark as read, False for unread.")


class FlagEmailInput(BaseModel):
    """Input for flagging/unflagging an email."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(..., description="ID of the email to flag.", min_length=1)
    flag_status: FlagStatus = Field(
        default=FlagStatus.FLAGGED,
        description="Flag status: 'flagged', 'notFlagged', or 'complete'.",
    )


class GetAttachmentsInput(BaseModel):
    """Input for listing attachments on an email."""
    model_config = ConfigDict(str_strip_whitespace=True)

    message_id: str = Field(..., description="ID of the email.", min_length=1)

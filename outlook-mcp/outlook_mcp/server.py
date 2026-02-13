"""
Outlook MCP Server — Microsoft Graph API email integration.

Provides 14 tools for email search, read, send, reply, draft, move,
flag, and attachment operations via the MCP protocol.
"""

import json
from datetime import datetime
from typing import Any, List, Optional

from mcp.server.fastmcp import FastMCP

from .graph_client import format_error, graph_request
from .models import (
    BodyFormat,
    DraftEmailInput,
    FlagEmailInput,
    ForwardEmailInput,
    GetAttachmentsInput,
    ListEmailsInput,
    ListFoldersInput,
    MarkReadInput,
    MoveEmailInput,
    ReadEmailInput,
    ReplyEmailInput,
    SearchEmailsInput,
    SendEmailInput,
)

mcp = FastMCP("outlook_mcp")


# ============================================================
#  Shared Formatting Helpers
# ============================================================

def _format_timestamp(iso_str: Optional[str]) -> str:
    """Convert ISO timestamp to human-readable format."""
    if not iso_str:
        return "Unknown"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y %I:%M %p")
    except (ValueError, AttributeError):
        return iso_str


def _format_recipients(recipients: Optional[List[dict]]) -> str:
    """Format a list of Graph API recipient objects."""
    if not recipients:
        return "None"
    parts = []
    for r in recipients:
        addr = r.get("emailAddress", {})
        name = addr.get("name", "")
        email = addr.get("address", "unknown")
        parts.append(f"{name} <{email}>" if name else email)
    return ", ".join(parts)


def _format_sender(sender: Optional[dict]) -> str:
    """Format a Graph API sender object."""
    if not sender:
        return "Unknown"
    addr = sender.get("emailAddress", {})
    name = addr.get("name", "")
    email = addr.get("address", "unknown")
    return f"{name} <{email}>" if name else email


def _build_recipient_list(emails: List[str]) -> List[dict]:
    """Convert email strings to Graph API recipient format."""
    return [{"emailAddress": {"address": e}} for e in emails]


def _format_email_summary(msg: dict, index: int = 0) -> str:
    """Format a single email as a summary row for list views."""
    sender = _format_sender(msg.get("from"))
    subject = msg.get("subject", "(no subject)")
    date = _format_timestamp(msg.get("receivedDateTime"))
    read = "✅" if msg.get("isRead") else "❌"
    attach = "📎" if msg.get("hasAttachments") else ""
    importance = msg.get("importance", "normal")
    imp_icon = "🔴" if importance == "high" else ""
    msg_id = msg.get("id", "")[:20]

    return f"| {index} | {sender[:30]} | {subject[:50]} | {date} | {read} | {attach}{imp_icon} |"


def _format_email_list(messages: List[dict], total: int, offset: int, folder: str = "Results") -> str:
    """Format a list of emails as a markdown table."""
    lines = [
        f"## {folder} ({len(messages)} of {total} emails)",
        "",
        "| # | From | Subject | Date | Read | Flags |",
        "|---|------|---------|------|------|-------|",
    ]
    for i, msg in enumerate(messages, start=offset + 1):
        lines.append(_format_email_summary(msg, i))

    if offset + len(messages) < total:
        lines.append("")
        lines.append(f"*More emails available. Use offset={offset + len(messages)} to see next page.*")

    return "\n".join(lines)


# Standard Graph select fields for list queries (minimize payload)
LIST_SELECT = "id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview,importance"


# ============================================================
#  TIER 1: Read Operations
# ============================================================

@mcp.tool(
    name="outlook_search_emails",
    annotations={
        "title": "Search Outlook Emails",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def outlook_search_emails(params: SearchEmailsInput) -> str:
    """Search Outlook emails using KQL syntax.

    Supports queries like 'from:john', 'subject:invoice', 'hasAttachments:true',
    and compound queries like 'from:boss AND subject:urgent received:this week'.

    Note: $search cannot be combined with $filter. For filtered listing use
    outlook_list_emails instead.

    Args:
        params: SearchEmailsInput with query, optional folder, limit, offset.

    Returns:
        Markdown table of matching emails with sender, subject, date, read status.
    """
    try:
        query_params = {
            "$search": f'"{params.query}"',
            "$top": params.limit,
            "$skip": params.offset,
            "$select": LIST_SELECT,
        }

        if params.folder:
            endpoint = f"me/mailFolders/{params.folder}/messages"
        else:
            endpoint = "me/messages"

        data = await graph_request(endpoint, params=query_params)
        messages = data.get("value", [])
        total = data.get("@odata.count", len(messages))

        if not messages:
            return f"No emails found matching '{params.query}'."

        return _format_email_list(messages, total, params.offset, f"Search: {params.query}")
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_read_email",
    annotations={
        "title": "Read Email Details",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def outlook_read_email(params: ReadEmailInput) -> str:
    """Read the full contents of a specific email by its message ID.

    Returns the complete email including sender, recipients, subject, date,
    body, and attachment list. Use message IDs from search or list results.

    Args:
        params: ReadEmailInput with message_id and body_format preference.

    Returns:
        Full email rendered as markdown with all metadata and body content.
    """
    try:
        prefer_header = f'outlook.body-content-type="{params.body_format.value}"'
        select = "id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,isRead,hasAttachments,importance,flag"

        data = await graph_request(
            f"me/messages/{params.message_id}",
            params={"$select": select, "$expand": "attachments($select=id,name,size,contentType)"},
        )

        body_content = data.get("body", {}).get("content", "(empty)")
        attachments = data.get("attachments", [])
        flag = data.get("flag", {}).get("flagStatus", "notFlagged")

        lines = [
            f"## {data.get('subject', '(no subject)')}",
            "",
            f"**From**: {_format_sender(data.get('from'))}",
            f"**To**: {_format_recipients(data.get('toRecipients'))}",
        ]

        cc = data.get("ccRecipients")
        if cc:
            lines.append(f"**CC**: {_format_recipients(cc)}")

        lines.extend([
            f"**Date**: {_format_timestamp(data.get('receivedDateTime'))}",
            f"**Read**: {'Yes' if data.get('isRead') else 'No'}",
            f"**Importance**: {data.get('importance', 'normal')}",
            f"**Flagged**: {flag}",
            f"**ID**: `{data.get('id', '')}`",
        ])

        if attachments:
            lines.append("")
            lines.append(f"**Attachments** ({len(attachments)}):")
            for att in attachments:
                size_kb = round(att.get("size", 0) / 1024, 1)
                lines.append(f"- {att.get('name', 'unnamed')} ({size_kb} KB, {att.get('contentType', 'unknown')})")

        lines.extend(["", "---", "", body_content])

        return "\n".join(lines)
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_list_emails",
    annotations={
        "title": "List Emails in Folder",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def outlook_list_emails(params: ListEmailsInput) -> str:
    """List emails in a specified folder with optional filters.

    Supports well-known folder names (inbox, sentitems, drafts, etc.)
    and filtering for unread-only emails.

    Args:
        params: ListEmailsInput with folder, limit, offset, unread_only.

    Returns:
        Markdown table of emails in the folder.
    """
    try:
        query_params: dict[str, Any] = {
            "$top": params.limit,
            "$skip": params.offset,
            "$orderby": "receivedDateTime desc",
            "$select": LIST_SELECT,
            "$count": "true",
        }

        if params.unread_only:
            query_params["$filter"] = "isRead eq false"

        data = await graph_request(
            f"me/mailFolders/{params.folder}/messages",
            params=query_params,
        )

        messages = data.get("value", [])
        total = data.get("@odata.count", len(messages))

        if not messages:
            label = "unread " if params.unread_only else ""
            return f"No {label}emails in {params.folder}."

        return _format_email_list(messages, total, params.offset, params.folder.capitalize())
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_list_folders",
    annotations={
        "title": "List Mail Folders",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def outlook_list_folders(params: ListFoldersInput) -> str:
    """List all mail folders in the user's mailbox.

    Returns folder names, IDs, and message counts. Useful for discovering
    custom folders beyond the well-known ones.

    Args:
        params: ListFoldersInput with limit.

    Returns:
        Markdown table of folders with name, ID, total count, and unread count.
    """
    try:
        data = await graph_request(
            "me/mailFolders",
            params={
                "$top": params.limit,
                "$select": "id,displayName,totalItemCount,unreadItemCount",
            },
        )

        folders = data.get("value", [])
        if not folders:
            return "No mail folders found."

        lines = [
            "## Mail Folders",
            "",
            "| Folder | Total | Unread | ID |",
            "|--------|-------|--------|-----|",
        ]
        for f in folders:
            name = f.get("displayName", "Unknown")
            total = f.get("totalItemCount", 0)
            unread = f.get("unreadItemCount", 0)
            fid = f.get("id", "")[:20]
            lines.append(f"| {name} | {total} | {unread} | `{fid}...` |")

        return "\n".join(lines)
    except Exception as e:
        return format_error(e)


# ============================================================
#  TIER 2: Action Operations
# ============================================================

@mcp.tool(
    name="outlook_send_email",
    annotations={
        "title": "Send Email",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def outlook_send_email(params: SendEmailInput) -> str:
    """Send a new email.

    Composes and sends an email with the specified recipients, subject,
    and body. Optionally saves to Sent Items.

    Args:
        params: SendEmailInput with to, subject, body, optional cc, importance.

    Returns:
        Confirmation message on success, or error details on failure.
    """
    try:
        message: dict[str, Any] = {
            "subject": params.subject,
            "body": {
                "contentType": params.body_type.value,
                "content": params.body,
            },
            "toRecipients": _build_recipient_list(params.to),
            "importance": params.importance.value,
        }

        if params.cc:
            message["ccRecipients"] = _build_recipient_list(params.cc)

        await graph_request(
            "me/sendMail",
            method="POST",
            json_body={
                "message": message,
                "saveToSentItems": params.save_to_sent,
            },
        )

        to_str = ", ".join(params.to)
        return f"✅ Email sent to {to_str}: \"{params.subject}\""
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_reply_email",
    annotations={
        "title": "Reply to Email",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def outlook_reply_email(params: ReplyEmailInput) -> str:
    """Reply to an existing email.

    Sends a reply to the sender (or all recipients if reply_all is True).

    Args:
        params: ReplyEmailInput with message_id, body, optional reply_all.

    Returns:
        Confirmation message on success.
    """
    try:
        endpoint_suffix = "replyAll" if params.reply_all else "reply"
        await graph_request(
            f"me/messages/{params.message_id}/{endpoint_suffix}",
            method="POST",
            json_body={
                "comment": params.body,
            },
        )

        action = "Reply-all" if params.reply_all else "Reply"
        return f"✅ {action} sent successfully."
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_forward_email",
    annotations={
        "title": "Forward Email",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def outlook_forward_email(params: ForwardEmailInput) -> str:
    """Forward an email to new recipients.

    Args:
        params: ForwardEmailInput with message_id, to, optional comment.

    Returns:
        Confirmation message on success.
    """
    try:
        body: dict[str, Any] = {
            "toRecipients": _build_recipient_list(params.to),
        }
        if params.comment:
            body["comment"] = params.comment

        await graph_request(
            f"me/messages/{params.message_id}/forward",
            method="POST",
            json_body=body,
        )

        to_str = ", ".join(params.to)
        return f"✅ Email forwarded to {to_str}."
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_draft_email",
    annotations={
        "title": "Create Draft Email",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def outlook_draft_email(params: DraftEmailInput) -> str:
    """Create a draft email without sending it.

    The draft will appear in the Drafts folder and can be reviewed,
    edited, or sent later.

    Args:
        params: DraftEmailInput with to, subject, body, optional cc, importance.

    Returns:
        Draft ID and confirmation message.
    """
    try:
        message: dict[str, Any] = {
            "subject": params.subject,
            "body": {
                "contentType": params.body_type.value,
                "content": params.body,
            },
            "toRecipients": _build_recipient_list(params.to),
            "importance": params.importance.value,
        }

        if params.cc:
            message["ccRecipients"] = _build_recipient_list(params.cc)

        data = await graph_request(
            "me/messages",
            method="POST",
            json_body=message,
        )

        draft_id = data.get("id", "unknown")
        return f"✅ Draft created: \"{params.subject}\"\n**Draft ID**: `{draft_id}`"
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_move_email",
    annotations={
        "title": "Move Email to Folder",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def outlook_move_email(params: MoveEmailInput) -> str:
    """Move an email to a different folder.

    Args:
        params: MoveEmailInput with message_id and destination_folder.

    Returns:
        Confirmation with new folder location.
    """
    try:
        data = await graph_request(
            f"me/messages/{params.message_id}/move",
            method="POST",
            json_body={"destinationId": params.destination_folder},
        )

        return f"✅ Email moved to {params.destination_folder}."
    except Exception as e:
        return format_error(e)


# ============================================================
#  TIER 3: Organization Operations
# ============================================================

@mcp.tool(
    name="outlook_mark_read",
    annotations={
        "title": "Mark Email Read/Unread",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def outlook_mark_read(params: MarkReadInput) -> str:
    """Mark an email as read or unread.

    Args:
        params: MarkReadInput with message_id and is_read flag.

    Returns:
        Confirmation of read status change.
    """
    try:
        await graph_request(
            f"me/messages/{params.message_id}",
            method="PATCH",
            json_body={"isRead": params.is_read},
        )

        status = "read" if params.is_read else "unread"
        return f"✅ Email marked as {status}."
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_flag_email",
    annotations={
        "title": "Flag/Unflag Email",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def outlook_flag_email(params: FlagEmailInput) -> str:
    """Set the flag status on an email (flagged, not flagged, or complete).

    Args:
        params: FlagEmailInput with message_id and flag_status.

    Returns:
        Confirmation of flag status change.
    """
    try:
        await graph_request(
            f"me/messages/{params.message_id}",
            method="PATCH",
            json_body={"flag": {"flagStatus": params.flag_status.value}},
        )

        return f"✅ Email flag set to: {params.flag_status.value}."
    except Exception as e:
        return format_error(e)


@mcp.tool(
    name="outlook_get_attachments",
    annotations={
        "title": "List Email Attachments",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def outlook_get_attachments(params: GetAttachmentsInput) -> str:
    """List all attachments on an email.

    Returns attachment names, sizes, and content types. Use the attachment
    IDs for download operations.

    Args:
        params: GetAttachmentsInput with message_id.

    Returns:
        Markdown list of attachments with metadata.
    """
    try:
        data = await graph_request(
            f"me/messages/{params.message_id}/attachments",
            params={"$select": "id,name,size,contentType,isInline"},
        )

        attachments = data.get("value", [])
        if not attachments:
            return "No attachments on this email."

        lines = [
            f"## Attachments ({len(attachments)})",
            "",
            "| # | Name | Size | Type | Inline |",
            "|---|------|------|------|--------|",
        ]
        for i, att in enumerate(attachments, 1):
            name = att.get("name", "unnamed")
            size_kb = round(att.get("size", 0) / 1024, 1)
            ctype = att.get("contentType", "unknown")
            inline = "Yes" if att.get("isInline") else "No"
            lines.append(f"| {i} | {name} | {size_kb} KB | {ctype} | {inline} |")

        return "\n".join(lines)
    except Exception as e:
        return format_error(e)


# ============================================================
#  Entry Point
# ============================================================

def main():
    """Run the Outlook MCP server via stdio transport."""
    mcp.run()


if __name__ == "__main__":
    main()

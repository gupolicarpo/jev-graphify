"""Envio de e-mail da fatura com PDF anexo."""
import smtplib
from email.message import EmailMessage


def build_invoice_email(customer, invoice, pdf_bytes: bytes, sender: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"], msg["To"] = sender, customer.email
    msg["Subject"] = f"Fatura {invoice.number} - vencimento {invoice.due_date:%d/%m/%Y}"
    msg.set_content(
        f"Olá, {customer.display_name()}.\nSegue a fatura {invoice.number} no valor de R$ {invoice.amount_due()}."
    )
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=f"{invoice.number}.pdf")
    return msg


def send_invoice_email(smtp_host: str, customer, invoice, pdf_bytes: bytes, sender: str) -> None:
    msg = build_invoice_email(customer, invoice, pdf_bytes, sender)
    with smtplib.SMTP(smtp_host, 587, timeout=15) as smtp:
        smtp.starttls()
        smtp.send_message(msg)

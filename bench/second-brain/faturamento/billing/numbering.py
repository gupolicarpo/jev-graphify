"""Numeração sequencial sem buracos por série."""
from dataclasses import dataclass


@dataclass
class InvoiceSequence:
    series: str
    last_number: int = 0

    def peek(self) -> int:
        return self.last_number + 1


def format_invoice_number(series: str, number: int) -> str:
    return f"{series}-{number:08d}"


def next_invoice_number(conn, series: str = "A") -> str:
    """Pega a próxima numeração com lock de linha, para não duplicar em emissões concorrentes."""
    with conn.transaction():
        row = conn.execute(
            "SELECT last_number FROM invoice_sequences WHERE series = %s FOR UPDATE", (series,)
        ).fetchone()
        if row is None:
            conn.execute("INSERT INTO invoice_sequences(series, last_number) VALUES (%s, 0)", (series,))
            atual = 0
        else:
            atual = row[0]
        proximo = atual + 1
        conn.execute("UPDATE invoice_sequences SET last_number = %s WHERE series = %s", (proximo, series))
    return format_invoice_number(series, proximo)


def release_unused_number(conn, series: str, number: int) -> bool:
    """Só devolve o número se for o último emitido; senão registra a inutilização."""
    row = conn.execute("SELECT last_number FROM invoice_sequences WHERE series = %s", (series,)).fetchone()
    if row and row[0] == number:
        conn.execute("UPDATE invoice_sequences SET last_number = %s WHERE series = %s", (number - 1, series))
        return True
    conn.execute("INSERT INTO invoice_voids(series, number) VALUES (%s, %s)", (series, number))
    return False

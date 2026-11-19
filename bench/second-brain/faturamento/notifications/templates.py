"""Textos de cobrança por estágio de atraso."""

DUNNING_STAGES = {
    1: "Lembrete amigável: a fatura {numero} venceu em {vencimento}.",
    2: "A fatura {numero} segue em aberto desde {vencimento}. Precisa de segunda via?",
    3: "Aviso final antes de suspender o serviço: fatura {numero}, vencida em {vencimento}.",
}


def render_dunning_message(stage: int, invoice) -> str:
    modelo = DUNNING_STAGES.get(stage, DUNNING_STAGES[3])
    return modelo.format(numero=invoice.number, vencimento=invoice.due_date.strftime("%d/%m/%Y"))

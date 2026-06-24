import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatBRL as formatCurrency, normalizePaymentMethod as normalizeMethod, getPaymentLabel } from '../lib/finance-utils';

export const generateCashierPDF = (session: any, transactions: any[], billing: any) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Relatório de Fechamento de Caixa', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Abertura: ${format(new Date(session.opened_at || session.openedAt), 'dd/MM/yyyy HH:mm')}`, 14, 30);
  doc.text(`Fechamento: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 36);
  doc.text(`Operador: ${session.opened_by_name || session.operator_name || 'Sistema'}`, 14, 42);

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Resumo Financeiro', 14, 55);
  
  const initialBalance = Number(session.initial_balance || session.initialBalance) || 0;
  const totalVendas = Number(billing.total) || 0;
  const totalReforcos = Number(billing.reinforcements) || 0;
  const totalSaidas = Number(billing.expenses) || 0;
  const expectedBalance = initialBalance + totalVendas + totalReforcos - totalSaidas;
  
  const summaryData = [
    ['Saldo Inicial', formatCurrency(initialBalance)],
    ['Vendas Totais', formatCurrency(totalVendas)],
    ['Reforços de Caixa', formatCurrency(totalReforcos)],
    ['Sangrias/Saídas', formatCurrency(totalSaidas)],
    ['Saldo Final Esperado', formatCurrency(expectedBalance)]
  ];

  autoTable(doc, {
    startY: 60,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 12 }
  });

  doc.setFontSize(14);
  doc.text('Vendas por Forma de Pagamento', 14, (doc as any).lastAutoTable.finalY + 15);
  
  const paymentData = Object.entries(billing.byMethod || {}).map(([method, amount]) => [
    getPaymentLabel(method).toUpperCase(),
    formatCurrency(amount as number)
  ]).filter(([_, amount]) => amount !== formatCurrency(0));

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Forma de Pagamento', 'Valor']],
    body: paymentData,
    headStyles: { fillColor: [16, 185, 129] },
  });

  if (transactions && transactions.length > 0) {
    doc.addPage();
    doc.text('Detalhamento de Transações', 14, 22);
    
    const transactionData = transactions.map(t => [
      format(new Date(t.created_at || t.timestamp), 'HH:mm'),
      t.description || '-',
      (t.type === 'expense' || t.type === 'sangria' || t.type === 'refund') ? 'SAÍDA' : 'ENTRADA',
      getPaymentLabel(t.payment_method || t.method || '').toUpperCase(),
      formatCurrency(Math.abs(Number(t.amount || 0)))
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Hora', 'Descrição', 'Tipo', 'Método', 'Valor']],
      body: transactionData,
      headStyles: { fillColor: [50, 50, 50] },
      columnStyles: {
        4: { halign: 'right' }
      }
    });
  }

  doc.save(`fechamento_caixa_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

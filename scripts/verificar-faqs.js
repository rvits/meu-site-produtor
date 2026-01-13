// scripts/verificar-faqs.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verificando FAQs no banco de dados...\n");

  try {
    const total = await prisma.fAQ.count();
    console.log(`✅ Total de FAQs no banco: ${total}\n`);

    if (total > 0) {
      const faqs = await prisma.fAQ.findMany({
        take: 5,
        orderBy: { views: "desc" },
      });

      console.log("📋 Primeiras 5 FAQs (mais visualizadas):");
      faqs.forEach((faq, index) => {
        console.log(`\n${index + 1}. [Views: ${faq.views}]`);
        console.log(`   Pergunta: ${faq.question}`);
        console.log(`   Resposta: ${faq.answer.substring(0, 50)}...`);
      });

      // Testar busca
      console.log("\n🔎 Testando busca por 'pagamento':");
      const buscaPagamento = await prisma.fAQ.findMany({
        where: {
          OR: [
            { question: { contains: "pagamento" } },
            { answer: { contains: "pagamento" } },
          ],
        },
        take: 3,
      });
      console.log(`   Encontradas: ${buscaPagamento.length} perguntas`);
      buscaPagamento.forEach((faq, index) => {
        console.log(`   ${index + 1}. ${faq.question}`);
      });
    } else {
      console.log("❌ Nenhuma FAQ encontrada no banco!");
      console.log("   Execute: npm run seed");
    }
  } catch (error) {
    console.error("❌ Erro ao verificar FAQs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
